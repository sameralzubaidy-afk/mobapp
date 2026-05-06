# Figma Agent Prompts: Pass It Up
**Copy-Paste Ready Prompts for Figma Make**  
**Date**: May 4, 2026  
**Version**: 1.0  
**Purpose**: One prompt per flow for Figma Make text box input

---

## How to Use This Document

Each section below contains a **copy-paste ready prompt** for Figma Make. These prompts reference the following design documents in your Figma repository:

- `app-overview.md` — App concept, user personas, business model
- `design-system.md` — Color palette, typography, components, spacing
- `screen-flow-mapping.md` — Screen inventory, user flows, component details

**Workflow:**
1. Copy the prompt for the flow you're working on
2. Paste into Figma Make text box and ask for adjustment for best UX. 
3. Let the agent generate the designs
4. Review and iterate as needed
5. Move to next flow

**Order of Execution:** Complete FLOW-00 (Design System) first, then proceed in priority order (P0 → P1 → P2).

---

## FLOW-00: Design System & Component Library

**Priority**: Foundation (Complete First)

```
You are designing the foundational Design System and Component Library for "Pass It Up," a kids marketplace mobile app. Reference design-system.md for all specifications.

DESIGN SYSTEM SETUP:
1. Create color styles from design-system.md Section 2:
   - Primary: Orange #FF6B35 + tints (#FF8E62, #FFB08F) + shades (#E6602F, #CC5529)
   - Secondary: Teal #00A896 + tints (#33BBA9, #66CEBC) + shades (#009780, #00856B)
   - Accent: Yellow #FFD23F
   - Neutrals: Gray-50 through Gray-900
   - Semantic: Success #10B981, Warning #F59E0B, Error #EF4444, Info #3B82F6
   - Backgrounds: White #FFFFFF, Light Gray #F8F9FA

2. Create text styles from design-system.md Section 3:
   - Heading/Display-1: Outfit Bold 32px (700 weight)
   - Heading/H2: Outfit SemiBold 24px (600 weight)
   - Heading/H3: Outfit SemiBold 20px (600 weight)
   - Body/Large: Inter Regular 16px (400 weight)
   - Body/Regular: Inter Regular 14px (400 weight)
   - Body/Small: Inter Regular 12px (400 weight)
   - Body/Large-Medium: Inter Medium 16px (500 weight)
   - Body/Regular-Medium: Inter Medium 14px (500 weight)
   - Technical/Mono: Fira Code Regular 14px (monospace)

3. Create spacing tokens (8px base grid):
   - xs: 4px, sm: 8px, md: 12px, base: 16px, lg: 24px, xl: 32px, 2xl: 48px, 3xl: 64px

4. Create effect styles:
   - Shadow/Card: 0 2px 8px rgba(0,0,0,0.08)
   - Shadow/Modal: 0 4px 16px rgba(0,0,0,0.12)
   - Shadow/Button: 0 1px 3px rgba(0,0,0,0.1)

CORE COMPONENTS (Create as component sets with variants):

Button Component Set:
- Variants: Primary, Secondary, Tertiary, Destructive
- States: Default, Hover, Pressed, Disabled
- Sizes: Large (48px height), Medium (44px height), Small (36px height)
- Primary: Orange bg (#FF6B35), white text, 8px radius, auto-layout horizontal, 16px padding horizontal
- Secondary: White bg, orange border (1px), orange text, 8px radius
- Tertiary: Transparent bg, orange text, no border
- Destructive: Red bg (#EF4444), white text, 8px radius
- Use auto-layout, min-touch-target 44x44px, add icon slot (boolean property)

Card Component Set:
- Variants: Standard, Featured, Compact
- Standard: White bg, gray-200 border (1px), 12px radius, 16px padding, shadow/card
- Featured: White bg, gradient border (orange-to-teal 2px), 12px radius, 16px padding, shadow/card
- Compact: White bg, gray-200 border (1px), 8px radius, 12px padding, shadow/card
- Use auto-layout vertical, content slot (instance swap)

Form Input Component Set:
- States: Default, Focus, Error, Disabled
- Default: White bg, gray-300 border (1px), 8px radius, 44px height, 12px padding horizontal
- Focus: White bg, orange border (2px), 8px radius
- Error: White bg, red border (2px), 8px radius, error text below (red, 12px)
- Disabled: Gray-100 bg, gray-300 border (1px), gray-500 text
- Use auto-layout, label above (gray-700, 14px medium), placeholder text (gray-400)

Modal Component Set:
- Variants: Bottom-Sheet, Full-Overlay, Action-Sheet
- Bottom-Sheet: White bg, rounded top corners (16px), bottom-anchored, backdrop (black 40% opacity)
- Full-Overlay: White bg, 16px radius, centered, backdrop (black 60% opacity), max-width 90% screen
- Action-Sheet: White bg, rounded top corners (12px), iOS-style list, backdrop (black 30% opacity)
- Use auto-layout, header slot, content slot, footer slot, close button (top-right)

SP Badge Component:
- Orange circle bg (#FF6B35), white text (14px medium), coin icon (16px), 6px radius
- Auto-layout horizontal, 4px gap, 8px padding horizontal, 24px height
- Variant: Small (12px text, 12px icon, 20px height)

Status Badge Component:
- Variants: Active, Sold, Expired, Pending, Completed, Cancelled
- Active: Green-100 bg, green-800 text (12px medium), 4px radius, 6px padding horizontal, 20px height
- Sold: Gray-100 bg, gray-800 text
- Expired: Red-100 bg, red-800 text
- Pending: Yellow-100 bg, yellow-800 text
- Completed: Blue-100 bg, blue-800 text
- Cancelled: Gray-200 bg, gray-600 text

Icon Placeholder Component:
- 24x24px frame (default size), gray-400 stroke, 2px stroke weight
- Variants: Small (16px), Large (32px)
- Note: Will be replaced with custom icon set later

LAYOUT GUIDELINES:
- Mobile frame: 375x812px (iPhone X/11/12 Pro size)
- Screen padding: 16px horizontal, varies vertical
- Safe area insets: 44px top (status bar), 34px bottom (home indicator)
- Bottom tab bar: 72px height (including safe area)
- Use auto-layout for all components and screens
- Set constraints: Left-Right for horizontal spacing, Top-Bottom for vertical spacing

DELIVERABLES:
- Color styles library (organized by Primary/Secondary/Accent/Neutrals/Semantic/Backgrounds)
- Text styles library (organized by Heading/Body/Technical)
- Component library with all variants above
- Spacing tokens as local variables
- Effect styles (shadows)
- Mobile frame template (375x812px with safe areas)

FIGMA-SPECIFIC REQUIREMENTS:

- AI Empowerment: Treat these requirements as a starting point. Please provide suggestions for UI/UX improvements, alternative screen layouts, or propose new screens if they create a more ideal user experience.
- AI Collaboration: Please ask clarification questions or push back on any requirements that do not make structural or UX sense.
- Dependencies: Call out any design or flow dependencies you encounter while reading the prompts.
- Recommendations: For any questions or pushback, please provide your specific recommendations for how to proceed.

- Prototype Configuration: Use "Smart Animate" for transitions (300ms ease-in-out)
- Prototype Configuration: Configure overflow scrolling for long content areas
- Prototype Configuration: Add bottom tab bar navigation to all applicable screens
- Prototype Configuration: Link all modal overlays to dismiss on background tap
- Prototype Configuration: Configure keyboard navigation for form flows
- Use component properties for variants (not manual variant creation)
- Boolean properties for optional elements (icons, labels)
- Instance swap properties for content slots
- Auto-layout everywhere (no absolute positioning except modal overlays)
- Set resizing constraints for responsive behavior
- Create component descriptions for each component
- Organize components in logical folders: Buttons/, Cards/, Forms/, Modals/, Badges/, Icons/
```

---

## FLOW-01: Authentication – Signup/Login/Logout

**Priority**: P0 (Critical) — First user touchpoint

```
Design the authentication flow for "Pass It Up" mobile app. Reference app-overview.md Section 1-2, design-system.md for styling, and screen-flow-mapping.md FLOW-01 for requirements.

SCREENS TO DESIGN (7 total):
1. LandingScreen
2. LoginScreen
3. SignupScreen
4. PhoneVerificationScreen
5. ForgotPasswordScreen
6. ResetPasswordScreen
7. SuspendedAccountScreen

Use 375x812px mobile frame, design-system.md color palette (Primary Orange #FF6B35, Secondary Teal #00A896), typography (Outfit headings, Inter body), and component library from FLOW-00.

---

SCREEN 1: LandingScreen
Frame: 375x812px, white background (#FFFFFF)

Header Section (top 40% of screen):
- Logo placeholder (centered, 80x80px, orange circle with "PIU" text)
- App name "Pass It Up" below logo (Heading/Display-1, orange #FF6B35)
- Tagline below name (Body/Large, gray-600): "Buy, sell, save. Kids gear made easy."

Hero Illustration (middle 30%):
- Placeholder illustration (300x200px): Parent + kid + items grid (use gray-300 rectangles as placeholders)
- Note: Will be replaced with custom illustration from $100 budget

Value Props Section (3 bullets, auto-layout vertical, 12px gap):
- Icon (24px orange circle) + Text (Body/Regular, gray-700): "Photo-first listings in seconds"
- Icon + Text: "Earn Swap Points on every sale"
- Icon + Text: "Safe local pickup in your neighborhood"

CTA Section (bottom, above safe area):
- "Sign Up" button (Button/Primary/Large, full-width minus 32px horizontal padding)
- "Log In" button (Button/Secondary/Large, full-width, 12px below Sign Up)
- Terms disclaimer (Body/Small, gray-500, centered): "By continuing, you agree to our Terms & Privacy Policy"

Auto-layout: Vertical, 24px gap between sections, 16px horizontal padding

---
FIELD INVENTORY — LandingScreen:

INPUT FIELDS (user-editable):
- None (marketing/landing screen only)

DISPLAY FIELDS (read-only):
- App logo + "Pass It Up" name: static brand asset
- Tagline: "Buy, sell, save. Kids gear made easy." (static)
- Value props x3: icon + marketing copy (static)
- "Sign Up" button: navigates to SignupScreen
- "Log In" button: navigates to LoginScreen
- Terms & Privacy disclaimer: links to TermsOfServiceScreen and PrivacyPolicyScreen
---

SCREEN 2: LoginScreen
Frame: 375x812px, white background

Header:
- Back button (top-left, 44x44px touch target, arrow icon 24px)
- "Log In" title (Heading/H2, gray-900, left-aligned, 16px from left)

Form Section (auto-layout vertical, 16px gap):
- Email Input (Form-Input/Default component, label "Email", placeholder "you@example.com")
- Password Input (Form-Input/Default, label "Password", placeholder "••••••••", eye icon toggle)
- "Forgot Password?" link (Body/Small, orange #FF6B35, right-aligned, underline)

Log In Button:
- Button/Primary/Large, "Log In" label, full-width
- 24px below password input

Divider:
- Horizontal line (1px, gray-300), "or" text centered in line (gray-500)
- 24px above and below

Social Login Section (auto-layout vertical, 12px gap):
- Google button (Button/Secondary/Medium, Google logo + "Continue with Google")
- Facebook button (Button/Secondary/Medium, Facebook logo + "Continue with Facebook")
- Apple button (Button/Secondary/Medium, Apple logo + "Continue with Apple")
- Note: Use official brand icon guidelines (will replace placeholders)

Bottom Link:
- "Don't have an account? Sign Up" (Body/Regular, centered, "Sign Up" in orange)

Constraints: Form section starts at 24px from top (below header), buttons fixed to bottom with 16px padding

---
FIELD INVENTORY — LoginScreen:

INPUT FIELDS (user-editable):
- Email: text input, required, keyboard: email, placeholder "you@example.com"
- Password: password input, required, toggle show/hide icon

DISPLAY FIELDS (read-only):
- "Forgot Password?" link: navigates to ForgotPasswordScreen
- Social login buttons (Google, Facebook, Apple): OAuth sign-in actions
- "Don't have an account? Sign Up" link: navigates to SignupScreen
- Inline error messages: "Invalid credentials", "Account not found", "Account deleted" (dynamic)
- Subscription status badge (post-login): free | trial | active (from session)
---

SCREEN 3: SignupScreen
Frame: 375x812px, white background

Header:
- Back button (top-left)
- "Sign Up" title (Heading/H2, gray-900)

Form Section (auto-layout vertical, 16px gap):
- Full Name Input (Form-Input/Default, label "Full Name", placeholder "Enter your full name", required asterisk)
- Email Input (Form-Input/Default, label "Email", placeholder "you@example.com", required asterisk)
- Phone Number Input (Form-Input/Default, label "Phone Number", placeholder "+1 (555) 123-4567", keyboard: phone-pad, required asterisk)
- Date of Birth Input (Form-Input/Default, label "Date of Birth", date picker icon right-aligned, required asterisk)
- Age note below DOB (Body/Small, gray-600): "You must be 18 or older to use Pass It Up"
- Password Input (Form-Input/Default, label "Create Password", placeholder "Min 8 characters", required asterisk)
- Password strength indicator below (horizontal bar, 4px height, gray-200 bg, green fill based on strength)
- Confirm Password Input (Form-Input/Default, label "Confirm Password", required asterisk)
- Referral Code Input (Form-Input/Default, label "Referral Code (Optional)", placeholder "Enter code if you have one")
- Helper text below (Body/Small, gray-500): "Have a friend's code? Get bonus SP!"

Sign Up Button:
- Button/Primary/Large, "Sign Up" label, full-width
- Disabled state initially (gray-300 bg, gray-500 text)

Divider + Social Login (same as LoginScreen)

Terms Checkbox:
- Checkbox (16x16px, gray-300 border, orange checkmark when selected)
- Text (Body/Small, gray-600): "I agree to the Terms of Service and Privacy Policy" (Terms/Privacy underlined)

Bottom Link:
- "Already have an account? Log In" (Body/Regular, centered, "Log In" in orange)

---
FIELD INVENTORY — SignupScreen:

INPUT FIELDS (user-editable):
- Full Name: text input, required, min 2 / max 100 characters
- Email: text input, required, keyboard: email, placeholder "you@example.com"
- Phone Number: text input, required, keyboard: phone-pad, format +1XXXXXXXXXX or 10+ digits
- Date of Birth: date picker, required, validates user is 18+ years old (COPPA compliance)
- Password: password input, required, min 8 chars, must include uppercase + lowercase + number; toggle show/hide
- Confirm Password: password input, required, must exactly match Password
- Referral Code: text input, optional, exactly 8 alphanumeric characters lowercase
- Terms & Privacy Checkbox: checkbox, required (Sign Up button disabled until checked)

DISPLAY FIELDS (read-only):
- Password strength indicator: visual bar, updates live (gray → red → yellow → green)
- Age validation error: "You must be 18 or older" (shown if DOB fails 18+ check)
- Referral code validation: "Valid code!" (green) or "Invalid code" (red), checked live
- Referral code helper: "Have a friend's code? Get bonus SP!" (static)
- "Already have an account? Log In" link: navigates to LoginScreen
- Terms of Service link: navigates to TermsOfServiceScreen
- Privacy Policy link: navigates to PrivacyPolicyScreen

AUTO-CALCULATED:
- Age: derived from Date of Birth, must be ≥18 (not shown to user)
- Trial subscription auto-enrolled on successful account creation
---

SCREEN 4: PhoneVerificationScreen
Frame: 375x812px, white background

Header:
- Back button (top-left)
- "Verify Phone" title (Heading/H2, gray-900)

Illustration:
- Phone icon (64x64px, orange circle bg, white phone icon inside)
- Centered at top

Instructions Text:
- "Enter the 6-digit code sent to" (Body/Regular, gray-700, centered)
- Phone number below "+1 (555) 123-4567" (Body/Large-Medium, gray-900, centered)
- "Edit" link next to phone number (Body/Small, orange)

OTP Input Section:
- 6 input boxes (48x56px each, auto-layout horizontal, 8px gap)
- Each box: white bg, gray-300 border (2px), 8px radius, single digit centered (Heading/H2)
- Active box: orange border (#FF6B35)
- Filled box: gray-900 text
- Empty box: gray-400 placeholder

Resend Code Section:
- "Didn't receive code?" (Body/Small, gray-600, centered)
- "Resend Code" button below (Body/Regular-Medium, orange, underline)
- Countdown timer if applicable: "Resend in 0:45" (Body/Small, gray-500)

Verify Button:
- Button/Primary/Large, "Verify & Continue" label, full-width
- Fixed to bottom (above safe area, 16px padding)
- Disabled until all 6 digits entered

Auto-layout: Vertical, 24px gap between sections

---
FIELD INVENTORY — PhoneVerificationScreen:

INPUT FIELDS (user-editable):
- OTP Code: 6-digit numeric input (6 separate boxes), required, numeric keyboard, auto-advances on each digit
- "Edit" tap: returns to previous screen to change phone number

DISPLAY FIELDS (read-only):
- Phone number: displays number passed from SignupScreen (e.g., "+1 (555) 123-4567")
- Countdown timer: "Resend in 0:45" (counts down from 60 seconds)
- "Resend Code" button: enabled after countdown expires
- Inline error: "Invalid or expired code" (dynamic)

AUTO-CALCULATED:
- Verification code auto-sent on screen mount
- Auto-submits when all 6 digits entered (no tap required)
- Countdown timer decrements every 1 second
---

SCREEN 5: ForgotPasswordScreen
Frame: 375x812px, white background

Header:
- Back button (top-left)
- "Reset Password" title (Heading/H2, gray-900)

Illustration:
- Lock icon (64x64px, orange circle bg, white lock icon inside)
- Centered

Instructions:
- "Enter your email and we'll send you a link to reset your password" (Body/Regular, gray-700, centered, 24px below illustration)

Email Input:
- Form-Input/Default component, label "Email", placeholder "you@example.com"
- 24px below instructions

Send Link Button:
- Button/Primary/Large, "Send Reset Link" label, full-width
- 16px below email input

Back to Login Link:
- "Back to Log In" (Body/Regular, centered, orange, bottom of screen)

Success State (show after button tap):
- Checkmark icon (64x64px, green circle bg, white checkmark)
- "Check your email" heading (Heading/H2, gray-900, centered)
- "We sent a password reset link to [email]" (Body/Regular, gray-700, centered)
- "Open Email App" button (Button/Primary/Large)
- "Didn't receive it? Resend" (Body/Small, orange, centered)

---
FIELD INVENTORY — ForgotPasswordScreen:

INPUT FIELDS (user-editable):
- Email: text input, required, keyboard: email, placeholder "you@example.com"

DISPLAY FIELDS (read-only):
- Instructions: "Enter your email and we'll send you a link to reset your password" (static)
- Success state (shown after submit): checkmark icon + "Check your email" heading + "We sent a reset link to [email]" (dynamic email)
- "Open Email App" button: opens device email app (success state only)
- "Didn't receive it? Resend" link: re-triggers reset email
- "Back to Log In" link: navigates to LoginScreen
- Error states: SMTP error, rate limit exceeded, email not found (inline, dynamic)
---

SCREEN 6: ResetPasswordScreen
Frame: 375x812px, white background

Header:
- "Create New Password" title (Heading/H2, gray-900, centered)

Instructions:
- "Your new password must be different from previous passwords" (Body/Regular, gray-600, centered)

Form Section (auto-layout vertical, 16px gap):
- New Password Input (Form-Input/Default, label "New Password", placeholder "Min 8 characters")
- Password strength indicator (same as SignupScreen)
- Confirm Password Input (Form-Input/Default, label "Confirm New Password")

Password Requirements Checklist:
- Auto-layout vertical, 8px gap, gray-100 bg, 12px padding, 8px radius
- Checkmark icon (16px green or gray) + Text (Body/Small):
  - "At least 8 characters"
  - "Contains uppercase letter"
  - "Contains number"
  - "Contains special character"

Reset Password Button:
- Button/Primary/Large, "Reset Password" label, full-width
- Fixed to bottom, disabled until requirements met

Success State (show after reset):
- Green checkmark icon (64x64px)
- "Password Reset!" heading (Heading/H2, gray-900, centered)
- "Your password has been reset successfully" (Body/Regular, gray-700, centered)
- "Continue to Log In" button (Button/Primary/Large)

---
FIELD INVENTORY — ResetPasswordScreen:

INPUT FIELDS (user-editable):
- New Password: password input, required, min 8 chars, must include uppercase + lowercase + number; toggle show/hide
- Confirm New Password: password input, required, must exactly match New Password

DISPLAY FIELDS (read-only):
- Password requirements checklist (4 items, icons update live as user types):
  • "At least 8 characters"
  • "Contains uppercase letter"
  • "Contains number"
  • "Contains special character"
- Password strength indicator: same bar as SignupScreen (live)
- Success state: green checkmark + "Password Reset!" + "Continue to Log In" button
- Error state: "Reset link expired or invalid" with link back to ForgotPasswordScreen

AUTO-CALCULATED:
- Access token + refresh token parsed from deep link URL fragment on mount
- Auth session set automatically from tokens
- Checklist items toggle green/gray live as user types
---

SCREEN 7: SuspendedAccountScreen
Frame: 375x812px, white background

Alert Icon:
- Red circle (80x80px, error red #EF4444 bg, white exclamation icon 40px)
- Centered at top

Heading:
- "Account Suspended" (Heading/Display-1, gray-900, centered, 24px below icon)

Message:
- "Your account has been suspended due to violation of our Terms of Service." (Body/Large, gray-700, centered, 16px below heading, 32px horizontal padding)

Details Box:
- White bg, red-100 border (2px), 8px radius, 16px padding
- Auto-layout vertical, 8px gap
- "Reason:" label (Body/Small-Medium, gray-900)
- Reason text (Body/Regular, gray-700): "[Admin-provided reason]"
- "Suspension Date:" label + date (Body/Small, gray-600)

Contact Support Section:
- "Need help?" (Body/Regular-Medium, gray-900, centered)
- "Contact our support team to appeal this decision" (Body/Regular, gray-600, centered)
- "Contact Support" button (Button/Primary/Large, full-width)

No Primary Actions (no "Continue" or "Log In" buttons)

Footer:
- "Terms of Service" link (Body/Small, orange, centered, underline)

---
FIELD INVENTORY — SuspendedAccountScreen:

INPUT FIELDS (user-editable):
- "Contact Support" button: opens external support channel (mailto or in-app)

DISPLAY FIELDS (read-only):
- Alert icon: red exclamation circle (static)
- "Account Suspended" heading (static)
- Suspension message: "Your account has been suspended due to violation of our Terms of Service." (static)
- Reason text: admin-provided reason string (dynamic, from DB)
- Suspension date: ISO date string formatted (dynamic, from DB)
- Support email: "admin-support@kidsmarketplace.app" (static)
- "Terms of Service" link: navigates to TermsOfServiceScreen
---

NAVIGATION FLOW:
- Landing → Sign Up → Phone Verification → (Onboarding - next flow)
- Landing → Log In → Dashboard
- Log In → Forgot Password → Reset Password → Log In
- Suspended Account → Contact Support (external)

FIGMA-SPECIFIC REQUIREMENTS:

- AI Empowerment: Treat these requirements as a starting point. Please provide suggestions for UI/UX improvements, alternative screen layouts, or propose new screens if they create a more ideal user experience.
- AI Collaboration: Please ask clarification questions or push back on any requirements that do not make structural or UX sense.
- Dependencies: Call out any design or flow dependencies you encounter while reading the prompts.
- Recommendations: For any questions or pushback, please provide your specific recommendations for how to proceed.

- Prototype Configuration: Use "Smart Animate" for transitions (300ms ease-in-out)
- Prototype Configuration: Configure overflow scrolling for long content areas
- Prototype Configuration: Add bottom tab bar navigation to all applicable screens
- Prototype Configuration: Link all modal overlays to dismiss on background tap
- Prototype Configuration: Configure keyboard navigation for form flows
- Use auto-layout for all screens (no absolute positioning)
- Create variants for input states (default, focus, error, filled)
- Create variants for button states (default, hover, pressed, disabled)
- Use component instances from FLOW-00 library
- Set proper constraints for responsive behavior
- Add interactive prototype connections between screens
- Create success state variants for ForgotPassword and ResetPassword screens
- Use boolean properties to toggle between normal/success states
```

---

## FLOW-02: Onboarding & Profile Setup

**Priority**: P0 (Critical) — User retention driver

```
Design the onboarding flow that guides new users through profile setup and app features. Reference app-overview.md Section 2 (user personas), design-system.md for styling, and screen-flow-mapping.md FLOW-02.

SCREENS TO DESIGN (5 total):
1. WelcomeScreen
2. ProfileCompletionScreen
3. FeatureHighlightsScreen (carousel)
4. OnboardingScreen (trading education carousel)
5. ProfileSetupScreen (post-OTP variant)

Use design-system.md components, 375x812px mobile frame, Samsung Food aesthetic (warm, friendly, accessible).

---

SCREEN 1: WelcomeScreen
Frame: 375x812px, white background

Hero Section (top 50%):
- Branded illustration (320x240px): Happy parent + kid + items (placeholder: use orange/teal color blocks)
- Budget note: $20-40 from $100 budget for custom illustration
- "Pass It Up" logo above illustration (40x40px)

Welcome Message (auto-layout vertical, centered, 16px horizontal padding):
- "Welcome!" (Heading/Display-1, orange #FF6B35)
- "Let's get you started with your local kids marketplace" (Body/Large, gray-700, centered)

Value Props (3 cards, auto-layout horizontal, scrollable carousel):
- Card 1: Icon (safety shield 32px) + "Safe Trades" + "Verified local families" (Body/Small, gray-600)
- Card 2: Icon (coins 32px) + "Earn SP" + "Rewards on every sale" (Body/Small)
- Card 3: Icon (camera 32px) + "Quick Listing" + "Photo-first in seconds" (Body/Small)
- Each card: White bg, 12px radius, 16px padding, shadow/card, 120px width

Get Started Button:
- Button/Primary/Large, "Get Started" label, full-width (minus 32px padding)
- Fixed to bottom (above safe area, 16px bottom padding)

Progress Indicator:
- 4 dots (8px diameter, gray-300), first dot orange #FF6B35
- Centered above button (indicates step 1 of 4)

---
FIELD INVENTORY — WelcomeScreen:

INPUT FIELDS (user-editable):
- "Get Started" button: navigates to ProfileCompletionScreen (primary action)

DISPLAY FIELDS (read-only):
- Hero illustration: branded asset (placeholder until custom art delivered)
- "Pass It Up" logo: static
- "Welcome!" heading + subtitle: static copy
- Value props x3 (Safe Trades, Earn SP, Quick Listing): static marketing cards
- Progress dots (4 dots): step 1 of 4, first dot orange (static)

AUTO-CALCULATED:
- Sets onboarding_completed = true and profile_completed = true upon completion of full flow
---

SCREEN 2: ProfileCompletionScreen
Frame: 375x812px, white background

Header:
- Progress bar (horizontal, full-width, 4px height, gray-200 bg, orange fill 25%)
- "Set Up Profile" title (Heading/H2, gray-900, 16px from left)
- "Step 1 of 4" subtitle (Body/Small, gray-600)

Avatar Upload Section (centered):
- Circle frame (120x120px, gray-200 bg, dashed border 2px gray-400)
- Camera icon inside (32px, gray-500)
- "Add Photo" text below circle (Body/Small, gray-600)
- "Optional" tag (Body/Small, gray-500, italic)
- Variant: After upload → circle shows cropped image (1:1 aspect ratio), edit icon overlay (bottom-right, 24px, orange circle bg, white pencil icon)

Form Fields (auto-layout vertical, 16px gap, starts 24px below avatar):
- Display Name Input (Form-Input/Default, label "Display Name", placeholder "How should we call you?", required asterisk)
- Character count below (Body/Small, gray-500): "0/50"
- Date of Birth Input (Form-Input/Default, label "Date of Birth", date picker icon right-aligned, required asterisk)
- Age verification text below (Body/Small, gray-600): "You must be 18+ to use Pass It Up"
- Bio Input (Form-Input/Textarea, label "About Me", placeholder "Tell us a little about yourself...", optional)
- Character count below (Body/Small, gray-500): "0/200"
- Helper text (Body/Small, gray-600): "Optional — you can edit this later in your profile"

Continue Button:
- Button/Primary/Large, "Continue" label, full-width
- Fixed to bottom
- Disabled until display name entered and valid DOB (18+)

Skip Link:
- "Skip for now" (Body/Small, gray-500, centered, above button)
- Crossed out (intentionally disabled per requirements)

---
FIELD INVENTORY — ProfileCompletionScreen:

INPUT FIELDS (user-editable):
- Avatar: image upload, optional, accepts jpg/png, crops to 1:1 circle
- Display Name: text input, required, min 2 / max 50 characters, placeholder "How should we call you?"
- Date of Birth: date picker, required, validates user is 18+ years old
- About Me (Bio): textarea, optional, max 200 characters, placeholder "Tell us a little about yourself..."

DISPLAY FIELDS (read-only):
- Progress bar: step 1 of 4, 25% filled (orange)
- Display Name character count: "0/50", updates live
- Age verification note: "You must be 18+ to use Pass It Up" (static, below DOB)
- Bio character count: "0/200", updates live
- Bio helper text: "Optional — you can edit this later in your profile" (static)

AUTO-CALCULATED (not shown to user):
- Age: derived from Date of Birth at time of submission
---

SCREEN 3: FeatureHighlightsScreen (Carousel)
Frame: 375x812px per slide, white background

Create 4 slides (swipeable carousel):

SLIDE 1: Photo-First Listing
- Illustration (300x280px, centered): Phone with camera + item grid (placeholder: orange/teal blocks)
- "List in Seconds" heading (Heading/H2, gray-900, centered)
- "Just snap a photo and we'll suggest the category and title" (Body/Large, gray-700, centered, 32px horizontal padding)

SLIDE 2: Swap Points Rewards
- Illustration (300x280px): Coins + items + happy face (placeholder)
- "Earn Swap Points" heading (Heading/H2, gray-900, centered)
- "Get SP on every sale and use them to save on your next purchase" (Body/Large, gray-700, centered)
- SP Badge example below text (orange badge "250 SP")

SLIDE 3: Local Pickup
- Illustration (300x280px): Map pin + neighborhood houses (placeholder)
- "Safe & Local" heading (Heading/H2, gray-900, centered)
- "Trade with verified families in your neighborhood" (Body/Large, gray-700, centered)

SLIDE 4: Safety Features
- Illustration (300x280px): Shield + checkmark + CPSC logo (placeholder)
- "Shop Safely" heading (Heading/H2, gray-900, centered)
- "Automatic recall checks and AI moderation keep your family safe" (Body/Large, gray-700, centered)

Shared Elements (all slides):
- Progress dots (bottom, centered, 48px above button): 4 dots (8px), current slide orange, others gray-300
- "Next" button (Button/Primary/Large, full-width, fixed to bottom) → changes to "Get Started" on slide 4
- "Skip" link (Body/Small, gray-500, centered, above button)

Auto-layout: Vertical, 32px gap between illustration and heading, 16px gap heading to body text

Prototype: Swipe horizontal to navigate slides, "Next" advances one slide, "Skip" jumps to OnboardingScreen

---
FIELD INVENTORY — FeatureHighlightsScreen:

INPUT FIELDS (user-editable):
- "Next" / "Get Started" button: advances slides, last slide navigates to OnboardingScreen
- "Skip" link: skips carousel, navigates directly to OnboardingScreen
- Swipe gesture: horizontal swipe to advance/go back between slides

DISPLAY FIELDS (read-only):
- Slide content x4 (illustration, heading, body copy): static marketing content
- Progress dots (4 dots): current slide highlighted orange (updates with swipe)
- "Next" button label changes to "Get Started" on slide 4 (dynamic)
---

SCREEN 4: OnboardingScreen (Trading Education Carousel)
Frame: 375x812px per slide, light gray background (#F8F9FA)

Create 3 education slides (swipeable):

SLIDE 1: How to Buy
- Card (white bg, 12px radius, shadow/card, 16px padding, centered):
  - Icon (64x64px): Shopping cart (teal circle bg, white icon)
  - "How to Buy" heading (Heading/H3, gray-900)
  - Steps list (auto-layout vertical, 12px gap):
    - "1. Browse or search for items" (Body/Regular, gray-700)
    - "2. Tap 'Buy Now' on item detail" (Body/Regular)
    - "3. Enter payment and apply SP" (Body/Regular)
    - "4. Coordinate pickup with seller" (Body/Regular)
    - "5. Mark complete when received" (Body/Regular)

SLIDE 2: How to Sell
- Card layout (same as slide 1):
  - Icon (64x64px): Camera (orange circle bg)
  - "How to Sell" heading
  - Steps:
    - "1. Take photos of your item" (Body/Regular, gray-700)
    - "2. We suggest category & title" (Body/Regular)
    - "3. Set your price" (Body/Regular)
    - "4. Publish listing" (Body/Regular)
    - "5. Earn SP when it sells!" (Body/Regular, orange text)

SLIDE 3: Swap Points 101
- Card layout:
  - Icon (64x64px): SP coin (orange circle)
  - "Understanding SP" heading
  - Explanation (Body/Regular, gray-700):
    - "• Earn SP on every sale (Premium members only)"
    - "• Spend up to 30-70% of purchase price in SP"
    - "• Pending SP released when buyer confirms delivery"
    - "• View wallet anytime in your profile"

Shared Elements:
- Progress dots (3 dots, current slide orange)
- "Next" button → "Done" on slide 3
- "Skip Tutorial" link (gray-500)

Prototype: Swipe to navigate, "Done" advances to next flow (Location Picker)

---
FIELD INVENTORY — OnboardingScreen (Trading Education):

INPUT FIELDS (user-editable):
- "Next" / "Done" button: advances slides, last slide navigates to LocationPickerScreen (FLOW-03)
- "Skip Tutorial" link: skips carousel, navigates directly to LocationPickerScreen
- Swipe gesture: horizontal swipe to navigate slides

DISPLAY FIELDS (read-only):
- Slide content x3 (How to Buy, How to Sell, Swap Points 101): static educational steps
- Progress dots (3 dots): current slide highlighted orange
- "Next" button label changes to "Done" on slide 3 (dynamic)

AUTO-CALCULATED:
- markOnboardingComplete() RPC called when user taps "Done"
- markOnboardingSkipped() RPC called when user taps "Skip Tutorial"
---

SCREEN 5: ProfileSetupScreen (Post-OTP Variant)
Frame: 375x812px, white background

Note: This is an alternate variant of ProfileCompletionScreen shown post-OTP verification

Header:
- "Almost There!" title (Heading/H2, orange #FF6B35)
- "Complete your profile to start trading" subtitle (Body/Regular, gray-700)

Form Section (same as ProfileCompletionScreen but pre-filled):
- Avatar upload (if not done earlier)
- Display name (may be pre-filled from OTP phone number)
- Date of birth

Additional Fields:
- Location section preview (read-only, shows ZIP entered in next screen)
- "You'll choose your neighborhood next" hint (Body/Small, gray-500)

Complete Profile Button:
- Button/Primary/Large, "Complete Profile" label
- Advances to FLOW-03 (Location Picker)

Difference from ProfileCompletionScreen:
- More welcoming tone (almost there vs. step 1 of 4)
- Context-aware based on signup path (social vs. email/password)

---
FIELD INVENTORY — ProfileSetupScreen (Post-OTP Variant):

INPUT FIELDS (user-editable):
- Avatar: image upload, optional, accepts jpg/png, crops to 1:1 circle
- Display Name: text input, required, min 2 / max 50 characters (may be pre-filled from phone/social account)
- Date of Birth: date picker, required, validates user is 18+ years old
- About Me (Bio): textarea, optional, max 200 characters

DISPLAY FIELDS (read-only):
- "Almost There!" heading + subtitle: static
- Avatar preview/placeholder
- Location preview hint: "You'll choose your neighborhood next" (static)
- Upload progress indicator (while avatar uploads)
- Validation errors: DOB age check, name length (dynamic)

AUTO-CALCULATED:
- Avatar uploaded to user-avatars storage bucket, public URL stored in profiles.avatar_url
- assignNodeByZipCode() RPC triggered on profile completion if ZIP already known
- Determines if waitlist popup should show (based on nearest node match)
---

NAVIGATION FLOW:
- Welcome → Profile Completion → Feature Highlights → Trading Education → Location Picker (FLOW-03)
- Alternative: Phone Verification → ProfileSetup → Location Picker

FIGMA-SPECIFIC REQUIREMENTS:

- AI Empowerment: Treat these requirements as a starting point. Please provide suggestions for UI/UX improvements, alternative screen layouts, or propose new screens if they create a more ideal user experience.
- AI Collaboration: Please ask clarification questions or push back on any requirements that do not make structural or UX sense.
- Dependencies: Call out any design or flow dependencies you encounter while reading the prompts.
- Recommendations: For any questions or pushback, please provide your specific recommendations for how to proceed.

- Prototype Configuration: Use "Smart Animate" for transitions (300ms ease-in-out)
- Prototype Configuration: Configure overflow scrolling for long content areas
- Prototype Configuration: Add bottom tab bar navigation to all applicable screens
- Prototype Configuration: Link all modal overlays to dismiss on background tap
- Prototype Configuration: Configure keyboard navigation for form flows
- Create carousel component for FeatureHighlights and OnboardingScreen (horizontal scroll frame)
- Use instance swap for slide content
- Create illustration placeholders with proper dimensions (will be replaced with custom art)
- Progress dots component (reusable, boolean property for active state)
- Avatar upload component with empty/filled states
- Form validation states (invalid DOB shows error state)
- Interactive prototype: swipe gestures, button transitions
- Create variants for "Next" button label ("Next" → "Get Started" → "Done")
```

---

## FLOW-03: Node/ZIP Gating & Location

**Priority**: P1 (High) — Location-based community access

```
Design the location selection flow for community/node access. Reference app-overview.md Section 1 (local marketplace model), design-system.md, and screen-flow-mapping.md FLOW-03.

SCREENS TO DESIGN (2 total):
1. LocationPickerScreen
2. NodeSelectionScreen

Use design-system.md components, emphasize local community aspect.

---

SCREEN 1: LocationPickerScreen
Frame: 375x812px, white background

Header:
- Progress bar (50% filled, orange)
- "Your Location" title (Heading/H2, gray-900)
- "Step 2 of 4" subtitle (Body/Small, gray-600)

Illustration:
- Map placeholder (320x200px): Stylized map with pins (orange/teal), centered
- Budget: $10-15 from illustration budget

Heading:
- "Where are you located?" (Heading/H3, gray-900, centered, 16px below illustration)

Instructions:
- "Enter your ZIP code to find your local marketplace community" (Body/Regular, gray-700, centered, 32px horizontal padding)

Location Input Section (auto-layout vertical, 16px gap):

City Input:
- Form-Input/Default component, full-width
- Label: "City" (Body/Regular-Medium, gray-900, required asterisk)
- Placeholder: "Los Angeles"
- Text input, capitalization: words
- Validation: Required, min 2 characters

State Input:
- Form-Input/Default component, full-width
- Label: "State" (Body/Regular-Medium, gray-900, required asterisk)
- Placeholder: "California"
- Text input or dropdown (US states), capitalization: words
- Validation: Required

ZIP Code Input:
- Form-Input/Default component, full-width
- Label: "ZIP Code" (Body/Regular-Medium, gray-900, required asterisk)
- Placeholder: "90210"
- Input: 5 digits, numeric keyboard, auto-format
- Validation: Real-time check (green checkmark icon appears if valid, red X if invalid)

Search Radius Slider (24px below location inputs):
- Label: "Search Radius" (Body/Regular-Medium, gray-900)
- Slider component (full-width minus 32px padding):
  - Track: gray-200 bg, 4px height
  - Filled track: orange #FF6B35
  - Thumb: 24px circle, white bg, orange border (2px), shadow
  - Min: 5 miles, Max: 50 miles, default: 15 miles
- Value display below slider (Body/Large, orange, centered): "15 miles"

Location Services Option:
- Icon (location pin 20px, gray-500) + "Use my current location" (Body/Regular, orange, underline)
- Tappable, 16px below slider

Map Preview (optional):
- Small map preview (full-width, 160px height, gray-200 bg with "Map preview" placeholder text)
- Note: May not be implemented (text-based ZIP entry only per requirements)

Continue Button:
- Button/Primary/Large, "Find My Community" label, full-width
- Fixed to bottom
- Disabled until all required fields completed: City, State, and valid 5-digit ZIP

Privacy Note:
- "We use your location to connect you with local families. Your exact address is never shared." (Body/Small, gray-500, centered, 16px horizontal padding, above button)

---
FIELD INVENTORY — LocationPickerScreen:

INPUT FIELDS (user-editable):
- City: text input, required, capitalization: words, min 2 chars, placeholder "Los Angeles"
- State: text input or dropdown (US states), required, placeholder "California"
- ZIP Code: numeric input, required, exactly 5 digits, numeric keyboard, placeholder "90210"
- Search Radius: slider, required, range 5–50 miles, default 15 miles
- "Use my current location": tap action (auto-fills City, State, ZIP via device GPS)

DISPLAY FIELDS (read-only):
- ZIP validation icon: green checkmark (valid) or red X (invalid), updates live
- Radius value label: "15 miles" updates live as slider moves
- Privacy note: "Your exact address is never shared." (static)
- Map preview: optional read-only map thumbnail (non-interactive)
---

SCREEN 2: NodeSelectionScreen
Frame: 375x812px, white background

Header:
- Back button (top-left)
- "Choose Community" title (Heading/H2, gray-900)

Subheading:
- "We found [X] communities near you" (Body/Regular, gray-700, 16px horizontal padding)
- ZIP + radius below: "90210 • 15 miles" (Body/Small, gray-500)

Node List (auto-layout vertical, 12px gap, scrollable):

Node Card Component (reusable):
- White bg, gray-200 border (1px), 12px radius, 16px padding
- Auto-layout vertical, 12px gap
- Top Row (horizontal, space-between):
  - Node name (Heading/H3, gray-900): "West LA Kids Marketplace"
  - Distance badge (Body/Small, gray-600, gray-100 bg, 6px radius, 8px padding): "3.2 mi"
- Stats Row (horizontal, 16px gap):
  - Active listings icon (24px, orange) + count (Body/Regular, gray-700): "142 active listings"
  - Members icon (24px, teal) + count: "89 members"
- Description:
  - "Serving West LA, Santa Monica, and Brentwood families" (Body/Small, gray-600)
- Select Button:
  - Button/Secondary/Medium, "Select Community" label, right-aligned
  - Variant: Selected state (orange bg, white text, "Selected" label, checkmark icon)

Show 3-5 node cards (if multiple available), otherwise single node with auto-select

No Communities Found State:
- Illustration (200x200px): Empty map with magnifying glass (gray-400)
- "No communities in your area yet" (Heading/H3, gray-700, centered)
- "Pass It Up is growing! Join the waitlist and we'll notify you when we launch in your area." (Body/Regular, gray-600, centered, 32px horizontal padding)
- "Join Waitlist" button (Button/Primary/Large)
- "Try a different ZIP" link (Body/Regular, orange, centered, 16px below button)

Waitlist Modal (show after "Join Waitlist" tap):
- Modal/Full-Overlay component
- "Join the Waitlist" heading (Heading/H2, gray-900)
- Email input (Form-Input/Default, label "Email", pre-filled if available)
- ZIP display (read-only): "You'll be notified when we launch in 90210"
- "Notify Me" button (Button/Primary/Large)
- "No thanks" link (Body/Small, gray-500, centered)

Continue Flow:
- After node selection → "Continue" button appears at bottom (Button/Primary/Large, full-width)
- Advances to Subscription Choice (FLOW-12, not in this prompt set)

Edit Location:
- "Change location" link (Body/Small, orange, top-right of header)
- Returns to LocationPickerScreen with current values pre-filled

---
FIELD INVENTORY — NodeSelectionScreen:

INPUT FIELDS (user-editable):
- "Select Community" / "Selected" button (per node card): selects which community to join
- "Continue" button: appears after selection, advances to Subscription Choice (FLOW-12)
- "Change location" link: navigates back to LocationPickerScreen
- "Join Waitlist" button (empty state only): opens Waitlist Modal
- "Try a different ZIP" link (empty state only): navigates back to LocationPickerScreen
- Waitlist Modal — Email: text input, optional (pre-filled if available), keyboard: email

DISPLAY FIELDS (read-only):
- Node cards (1–5): name, distance badge (e.g. "3.2 mi"), active listings count, member count, description
- ZIP + radius summary: "90210 • 15 miles" (from previous screen, dynamic)
- "We found [X] communities near you" heading (dynamic count)
- Node status: active or inactive (affects button shown)
- Empty state: illustration + "No communities in your area yet" (conditional)
- Waitlist Modal: ZIP display read-only, email pre-filled if known

AUTO-CALCULATED:
- Node data loaded by nodeId from assignNodeByZipCode() result
- Node status determines which button variant to show (Join vs. Looks Good)
- waitlist_registrations entry created if user joins waitlist
---

NAVIGATION FLOW:
- Location Picker → Node Selection → (Subscription Choice - next flow)
- Alternative: No nodes → Waitlist Modal → Email confirmation → Exit onboarding

FIGMA-SPECIFIC REQUIREMENTS:

- AI Empowerment: Treat these requirements as a starting point. Please provide suggestions for UI/UX improvements, alternative screen layouts, or propose new screens if they create a more ideal user experience.
- AI Collaboration: Please ask clarification questions or push back on any requirements that do not make structural or UX sense.
- Dependencies: Call out any design or flow dependencies you encounter while reading the prompts.
- Recommendations: For any questions or pushback, please provide your specific recommendations for how to proceed.

- Prototype Configuration: Use "Smart Animate" for transitions (300ms ease-in-out)
- Prototype Configuration: Configure overflow scrolling for long content areas
- Prototype Configuration: Add bottom tab bar navigation to all applicable screens
- Prototype Configuration: Link all modal overlays to dismiss on background tap
- Prototype Configuration: Configure keyboard navigation for form flows
- Slider component with interactive prototype (drag thumb updates value display)
- Node card component with selected/unselected variant (boolean property)
- Empty state variant for NodeSelectionScreen
- Waitlist modal component (instance of Modal/Full-Overlay from FLOW-00)
- ZIP input with validation states (default, valid, invalid)
- Auto-layout for node list (vertical scroll)
- Constraints: node cards resize horizontally to fill width
- Create number variable for node count (1-5+ scenarios)
```

---

## FLOW-06: Discovery – Search/Browse/Filters

**Priority**: P0 (Critical) — Core discovery loop

```
Design the discovery and search experience. Reference app-overview.md Section 1 (marketplace concept), design-system.md, and screen-flow-mapping.md FLOW-06 for detailed filter requirements.

SCREENS TO DESIGN (3 total):
1. DiscoverScreen (unified search + browse)
2. CategoryBrowseScreen
3. ItemDetailScreen

MODAL TO DESIGN:
- SearchFilterModal (bottom sheet, 8 filter sections)

Use design-system.md components, emphasize photo-first marketplace, easy browsing.

---

SCREEN 1: DiscoverScreen
Frame: 375x812px, white background (#FFFFFF)

Top Bar (fixed, doesn't scroll):
- Search bar (auto-layout horizontal, full-width minus 16px padding, 48px height):
  - Pill shape (24px radius, gray-100 bg)
  - Magnifying glass icon (20px, gray-500, 12px from left)
  - Placeholder text: "Search kids gear..." (Body/Regular, gray-500)
  - Filter button (right side, 36x36px, orange circle bg when filters active, gray-200 when inactive, filter icon 20px white/gray-700)
  - Filter count badge (12px red circle, white text "3", top-right of filter button, only show when filters active)

Sort & Filter Row (auto-layout horizontal, space-between, 12px below search):
- Left: Active filter chips (horizontal scroll):
  - Chip component: gray-100 bg, 6px radius, 8px padding horizontal, 28px height
  - Text (Body/Small, gray-700): "Clothing" + X icon (16px, tap to remove)
  - Show 0-3 chips, "+2 more" if more than 3 active
- Right: Sort dropdown (auto-layout horizontal):
  - "Sort:" label (Body/Small, gray-600)
  - Dropdown value (Body/Regular-Medium, gray-900): "Relevant"
  - Chevron down icon (16px, gray-600)

Content Section (scrollable):

Category Shortcuts (horizontal scroll, no scrollbar):
- 8-10 category pills (auto-layout horizontal, 8px gap, 16px from left edge):
  - Pill: white bg, gray-300 border (1px), 8px radius, 12px padding horizontal, 32px height
  - Icon (24px) + Label (Body/Small, gray-700): "Clothing", "Toys", "Gear", "Books", "Sports", "Baby", "Furniture", "Electronics"
  - Selected state: orange bg (#FF6B35), white text, white icon

Section Header (16px below categories):
- "Popular Near You" (Heading/H3, gray-900, 16px from left)
- "See all" link (Body/Small, orange, 16px from right)

Item Grid (2 columns, 12px gap, 16px horizontal padding):
- Use ItemCard component (create from FLOW-00 spec):
  - Frame: ~170px width (responsive), auto-height
  - Image (1:1 aspect ratio, 12px radius top corners)
  - Overlay: Favorite heart icon (top-right, 32x32px, white bg 60% opacity, 16px radius, red when favorited)
  - Content section (12px padding):
    - Title (Body/Regular, gray-900, 2 lines max, ellipsis): "Kids Winter Jacket Size 6"
    - Price row (horizontal, space-between):
      - Price (Heading/H3, gray-900): "$24"
      - SP Badge component (orange, small variant): "250 SP"
    - Location (Body/Small, gray-600): "3.2 mi • Santa Monica"
  - Shadow: shadow/card

Show 6 items initially, infinite scroll loads more

Empty State (no results):
- Illustration (240x240px): Magnifying glass + empty box (gray-400)
- "No items found" (Heading/H3, gray-700, centered)
- "Try adjusting your filters or search term" (Body/Regular, gray-600, centered)
- "Clear Filters" button (Button/Secondary/Medium, centered) if filters active

Bottom Tab Bar (fixed, 72px height including safe area):
- 4 tabs: Discover (active), Messages, Profile, More
- Active tab: orange icon + label (#FF6B35)
- Inactive: gray-500
- Icons 24px, labels Body/Small

---
FIELD INVENTORY — DiscoverScreen:

INPUT FIELDS (user-editable):
- Search query: text input, debounced 200ms, placeholder "Search kids gear..."
- Category shortcut chips: single-select tap (filters by category)
- Filter button: opens SearchFilterModal (tracks active filter count)
- Sort dropdown: single-select (Most Relevant | Newest First | Price Low–High | Price High–Low | Distance Nearest)
- Favorite heart (per item card): toggle saved/unsaved
- Pull-to-refresh: RefreshControl gesture

DISPLAY FIELDS (read-only):
- Item cards grid (2 columns): image, title, price, SP badge, distance (dynamic from DB)
- Active filter chips row: applied filters with remove × (dynamic)
- Filter count badge: red dot with number on filter button (dynamic)
- Autocomplete suggestions: up to 5 items based on query (dynamic)
- Spell correction: "Did you mean X?" (dynamic, conditional)
- Empty state: "No items found" + Clear Filters button (conditional)
- "Popular Near You" section header + "See all" link (dynamic count)

AUTO-CALCULATED:
- debouncedQuery (200ms keystroke delay, 0ms for filter/sort)
- countActiveFilters() — number shown on filter badge
- suggestSpellingCorrection() for common typos
- Pagination offset tracking for infinite scroll (20 per page)
---

SCREEN 2: CategoryBrowseScreen
Frame: 375x812px, white background

Header:
- Back button (top-left)
- Category name (Heading/H2, gray-900): "Clothing"
- Filter button (top-right, same as DiscoverScreen)

Breadcrumb (optional, if subcategory):
- "All Categories > Clothing > Boys" (Body/Small, gray-600, chevron separators)

Filter & Sort Row (same as DiscoverScreen):
- Active filter chips (horizontal scroll)
- Sort dropdown

Item Grid (same 2-column layout as DiscoverScreen):
- Show all items in selected category
- Infinite scroll
- Item count above grid: "142 items" (Body/Small, gray-600)

Filter by Size Section (horizontal scroll, if applicable to category):
- Size chips (between filter row and grid):
  - "2T", "3T", "4T", "5", "6", "7", "8" (Body/Small, gray-700)
  - White bg, gray-300 border (1px), 6px radius, 8px padding
  - Selected: orange bg, white text

Empty State (same as DiscoverScreen)

---
FIELD INVENTORY — CategoryBrowseScreen:

INPUT FIELDS (user-editable):
- SP-eligible filter toggle (Switch): filters to only SP-accepting listings
- Size chips: multi-select, category-dependent (clothing/shoe sizes)
- Filter button: opens SearchFilterModal
- Favorite heart (per item card): toggle saved/unsaved
- Pull-to-refresh: RefreshControl gesture

DISPLAY FIELDS (read-only):
- Category name in header (dynamic, from navigation params)
- Item count: "142 items" (dynamic)
- Item cards grid: same 2-column layout as DiscoverScreen (dynamic from DB)
- Breadcrumb: "All Categories > Clothing > Boys" (dynamic, if subcategory)
- SP toggle explanation text (static)
- Empty state: illustration + "No items" message (conditional)

AUTO-CALCULATED:
- fetchListingsByCategory(category, spEligibleOnly) RPC
- Filtered items based on SP toggle state
---

SCREEN 3: ItemDetailScreen
Frame: 375x812px, white background

Image Carousel (top, full-width, 375x375px):
- Horizontal scroll (snap to each image)
- Page indicators (dots, bottom-center, 8px from bottom edge)
- Favorite heart (top-right, 40x40px, white bg 80% opacity, 20px radius, toggles red)
- Back button (top-left, same styling)
- Image counter (bottom-left, gray-900 bg 60% opacity, white text, 6px radius, 8px padding): "1 / 4"

Seller Info Section (16px horizontal padding, 16px below carousel):
- Auto-layout horizontal, 12px gap
- Avatar (48x48px circle, user photo or initials on orange bg)
- Name + stats (auto-layout vertical, 4px gap):
  - Display name (Body/Large-Medium, gray-900): "Sarah M."
  - Star rating (16px star icons, 5 total, filled orange for rating) + count (Body/Small, gray-600): "4.8 (23 reviews)"
  - Member badge (Body/Small, teal text, teal-100 bg, 4px radius, 6px padding): "Premium Member"
- Message button (right-aligned, Button/Tertiary/Small, message icon 20px)

Item Details Section (16px horizontal padding, 16px below seller):
- Title (Heading/H2, gray-900): "Kids Winter Jacket North Face Size 6"
- Price row (horizontal, space-between, 8px below title):
  - Price (Heading/Display-1, orange #FF6B35): "$24"
  - SP earn badge (orange badge, small): "Earn 250 SP"
- Condition chip (8px below price): "Like New" (green-100 bg, green-800 text, 4px radius, 8px padding, Body/Small)

Description Section (16px horizontal padding, 16px below condition):
- "Description" label (Body/Regular-Medium, gray-900)
- Description text (Body/Regular, gray-700, 4px below label): "Barely worn North Face winter jacket in excellent condition. Size 6, fits kids 5-7 years old. No stains or tears. Smoke-free home."
- "Read more" link if text exceeds 3 lines (Body/Small, orange)

Specifications Grid (16px horizontal padding, 16px below description):
- 2-column grid, 8px gap:
  - Label (Body/Small, gray-600) + Value (Body/Regular, gray-900)
  - "Category": "Clothing > Outerwear"
  - "Size": "6 (5-7 years)"
  - "Brand": "North Face"
  - "Condition": "Like New"
  - "Location": "Santa Monica, CA"
  - "Posted": "2 days ago"

Safety Banner (if recall detected):
- Red-100 bg, red-600 border-left (4px), 12px padding, 8px radius
- Warning icon (24px, red-600) + Text (Body/Regular, red-900): "This item may be subject to a recall. View details"
- 16px below specifications

Bottom CTA Section (fixed to bottom, white bg, shadow, safe area insets):
- Auto-layout horizontal, 16px padding, 12px gap
- "Add to Cart" button (Button/Secondary/Medium, flex-grow): "Add to Cart" + cart icon
- "Buy Now" button (Button/Primary/Large, flex-grow): "Buy Now"
- Both buttons 48px height

Shipping/Pickup Info (above CTA, 12px padding, gray-50 bg):
- Icon (truck 20px, gray-600) + Text (Body/Small, gray-700): "Local pickup in Santa Monica • Meet safely"

---
FIELD INVENTORY — ItemDetailScreen:

INPUT FIELDS (user-editable):
- "Buy Now" button: navigates to TradeInitiationScreen (FLOW-08)
- "Add to Cart" button: adds item to active cart (FLOW-07)
- Favorite heart (top-right of image): toggle saved/unsaved
- "Contact Seller" / message button: opens ChatScreen (FLOW-13)
- "Read more" link: expands full description (toggle)

DISPLAY FIELDS (read-only):
- Item images carousel: up to 6 images, page dots, image counter "1 / 4" (dynamic from item_images)
- Item title (dynamic)
- Item price (dynamic): "$24"
- SP earn badge (dynamic, conditional): "Earn 250 SP" (only if seller accepts SP)
- Item condition badge (dynamic): "Like New"
- Category breadcrumb (dynamic): "Clothing > Outerwear"
- Description text (dynamic, 3 lines max + Read More)
- Specs grid (dynamic): Category, Size, Brand, Condition, Location, Posted date
- Seller avatar + display name (dynamic)
- Seller star rating + review count (dynamic)
- Seller verification badge (dynamic: Premium Member, ID Verified)
- Transaction fee display (dynamic: $0.99 subscriber | $2.99 free user)
- Safety recall banner (conditional red banner — only if CPSC recall detected)
- Pickup info: "Local pickup in [City] • Meet safely" (dynamic city)

AUTO-CALCULATED:
- buyerCanSpendSP (from session.can_spend_sp)
- hasActiveTrade (hasActiveTradeBetween RPC) — controls seller name visibility
- sellerRating (getSellerRating RPC)
- Fee amount based on buyer subscription tier
- sellerVerificationStatus (idBadgeService.getVerificationStatus RPC)
---

MODAL: SearchFilterModal
Modal type: Bottom-Sheet (from FLOW-00 component library)

Header:
- "Filters" title (Heading/H2, gray-900, 16px from left)
- Close X (top-right, 44x44px touch target)
- "Clear all" link (Body/Small, orange, right of title)

Filter count badge (if filters active):
- Top-right corner, red circle, white text: "5 active"

Content (scrollable, 8 sections):

SECTION 1: Category
- Label: "Category" (Body/Regular-Medium, gray-900)
- Multi-select chips (wrap, 8px gap):
  - Chips: "Clothing", "Toys", "Gear", "Books", "Sports", "Baby", "Furniture", "Electronics", "+12 more"
  - Unselected: white bg, gray-300 border (1px)
  - Selected: orange bg (#FF6B35), white text
  - Checkmark icon (16px) when selected

SECTION 2: Condition
- Label: "Condition" (Body/Regular-Medium, gray-900)
- Single-select chips (4 options):
  - "New", "Like New", "Good", "Fair"
  - Same styling as category chips

SECTION 3: Price Range
- Label: "Price Range" (Body/Regular-Medium, gray-900)
- Two inputs (horizontal, 12px gap):
  - Min input (Form-Input/Default, 100px width, "$" prefix, placeholder "Min")
  - "-" separator (gray-500)
  - Max input (placeholder "Max")
- Range slider below (same as ZIP radius slider):
  - Min: $0, Max: $500, dual thumbs
  - Values update inputs in real-time

SECTION 4: Size
- Label: "Size" (Body/Regular-Medium, gray-900)
- Category-dependent chips:
  - Clothing: "Newborn", "0-3M", "3-6M", ... "2T", "3T", "4T", "5", "6", "7", ... "XS", "S", "M", "L", "XL"
  - Shoes: "0", "1", "2", ... "13", "1Y", "2Y", ... "7Y"
  - Multi-select, wrap

SECTION 5: Brand
- Label: "Brand" (Body/Regular-Medium, gray-900)
- Search input (Form-Input/Default, magnifying glass icon, placeholder "Search brands...")
- Popular brands chips (wrap, 8px gap):
  - "Nike", "Carter's", "GAP Kids", "Old Navy", "Target", "H&M Kids"
- Multi-select

SECTION 6: Age Range
- Label: "Age Range" (Body/Regular-Medium, gray-900)
- Category-dependent chips:
  - "0-6 months", "6-12 months", "1-2 years", "2-4 years", "4-6 years", "6-8 years", "8-10 years", "10-12 years", "12+ years"
- Multi-select

SECTION 7: Location
- Label: "Distance" (Body/Regular-Medium, gray-900)
- Current location display (Body/Small, gray-600): "From 90210"
- Radius slider (same as LocationPickerScreen):
  - Min: 1 mile, Max: 50 miles, default: 15
  - Value display: "Within 15 miles"

SECTION 8: Keywords
- Label: "Keywords" (Body/Regular-Medium, gray-900)
- Text input (Form-Input/Default, placeholder "Add keywords...", multi-line, 3 rows)
- Keyword chips below (if any added):
  - Display entered keywords as removable chips

Footer (fixed to bottom, white bg, shadow):
- "Show [X] results" button (Button/Primary/Large, full-width)
- Updates count in real-time as filters change

---

Sort Dropdown Menu (show when dropdown tapped on DiscoverScreen):
- Modal/Action-Sheet component
- Options (radio buttons, single-select):
  - "Most Relevant" (default)
  - "Newest First"
  - "Price: Low to High"
  - "Price: High to Low"
  - "Distance: Nearest"
- "Apply" button (Button/Primary/Medium)

---
FIELD INVENTORY — SearchFilterModal:

INPUT FIELDS (user-editable):
- Category chips: multi-select (Clothing, Toys, Gear, Books, Sports, Baby, Furniture, Electronics, +more)
- Condition chips: single-select (New | Like New | Good | Fair)
- Price range: min text input (numeric) + max text input (numeric) + dual-thumb slider ($0–$500)
- Size chips: multi-select, category-dependent (clothing sizes, shoe sizes)
- Brand search input: text input + popular brand chips multi-select
- Age range chips: multi-select (0-6mo, 6-12mo, 1-2yr, 2-4yr, 4-6yr, 6-8yr, 8-10yr, 10-12yr, 12+yr)
- Distance radius slider: 1–50 miles, default 15 miles
- Keywords: text input, multi-entry, creates removable chips
- "Clear all" link: resets all filters
- "Show [X] results" button: applies filters, closes modal

DISPLAY FIELDS (read-only):
- Active filter count: "[N] active" badge in header (dynamic, updates live)
- "Show [X] results" button label: count updates live as filters change (dynamic)
- Location "From [ZIP]": user's current ZIP (dynamic)
- Popular brand chips list (static pre-populated)
---

NAVIGATION FLOW:
- Discover → Item Detail → Buy Now (FLOW-08)
- Discover → Category Browse → Item Detail
- Discover → Filter Modal → Apply → Filtered Results
- Discover → Search → Type query → Results → Item Detail

FIGMA-SPECIFIC REQUIREMENTS:

- AI Empowerment: Treat these requirements as a starting point. Please provide suggestions for UI/UX improvements, alternative screen layouts, or propose new screens if they create a more ideal user experience.
- AI Collaboration: Please ask clarification questions or push back on any requirements that do not make structural or UX sense.
- Dependencies: Call out any design or flow dependencies you encounter while reading the prompts.
- Recommendations: For any questions or pushback, please provide your specific recommendations for how to proceed.

- Prototype Configuration: Use "Smart Animate" for transitions (300ms ease-in-out)
- Prototype Configuration: Configure overflow scrolling for long content areas
- Prototype Configuration: Add bottom tab bar navigation to all applicable screens
- Prototype Configuration: Link all modal overlays to dismiss on background tap
- Prototype Configuration: Configure keyboard navigation for form flows
- ItemCard component with favorite toggle (boolean property)
- SearchFilterModal with section components (auto-layout vertical, 24px gap between sections)
- Filter chips with selected/unselected variants (component property)
- Image carousel component with page indicators (horizontal scroll frame)
- Dual-thumb range slider (complex component, may need prototype simulation)
- Interactive prototype: filter modal slide up, carousel swipe, chip selection
- Create variants for empty states
- Bottom sheet modal constraints (anchor to bottom, overlay above)
- Infinite scroll indication (use placeholder "Load more..." at bottom)
```

---

## FLOW-04: Listings – Create/Edit/Delete

**Priority**: P0 (Critical) — Seller activation, photo-first marketplace

```
Design the listing creation and management flow. Reference app-overview.md Section 1 (photo-first marketplace), design-system.md, and screen-flow-mapping.md FLOW-04 for detailed requirements. This flow integrates FLOW-05 (Media Upload).

SCREENS TO DESIGN (5 total):
1. ItemCreateScreen (primary photo-first flow)
2. BulkListingCreateScreen
3. EditListingScreen
4. MyListingsScreen
5. ListingSafetyReviewScreen

Use design-system.md components, emphasize photo-first experience, progressive disclosure.

---

SCREEN 1: ItemCreateScreen (Photo-First Flow)
Frame: 375x812px, white background

Header:
- Close X button (top-left, 44x44px touch target)
- "Create Listing" title (Heading/H2, gray-900, centered)
- "Save Draft" link (top-right, Body/Small, orange)

Progress Indicator (below header):
- 4 steps: Photo → Details → Price → Review
- Horizontal stepper (auto-layout, 8px gap):
  - Step circle (32px diameter, orange filled for current/completed, gray-200 for pending)
  - Step label below (Body/Small, orange for current, gray-500 for pending)
  - Connector line between steps (2px, orange for completed, gray-200 for pending)

---

STEP 1: Photo Upload (initial state)

Hero Upload Area (centered, 60% of screen height):
- Large dashed border rectangle (full-width minus 32px padding, 400px height, gray-300 border 2px dashed, 12px radius)
- Camera icon (64x64px, orange #FF6B35)
- "Add Photos" heading (Heading/H3, gray-900, 12px below icon)
- "Tap to take photo or choose from gallery" (Body/Regular, gray-600, centered)
- "Up to 6 photos" hint (Body/Small, gray-500)

Bottom Buttons (fixed, above safe area):
- "Take Photo" button (Button/Primary/Large, camera icon, full-width)
- "Choose from Gallery" button (Button/Secondary/Large, gallery icon, full-width, 12px below)

---

STEP 1: Photo Upload (after adding photos)

Photo Grid (2x3 layout, 8px gap, 16px horizontal padding):
- Photo slot (170x170px each):
  - Uploaded photo variant: Image (fill frame, 8px radius), delete X button (top-right, 24x24px, red circle bg, white X)
  - Empty slot variant: Dashed border (gray-300), plus icon (32px, gray-400), "Add Photo" text (Body/Small, gray-500)
  - Drag handle icon (bottom-right, 20x20px, gray-500) for reordering
- First photo has "Cover" badge (orange bg, white text, 6px radius, 8px padding, Body/Small, bottom-left corner)

Upload Progress (show while uploading):
- Progress bar overlay on photo slot (gray-800 bg 60% opacity, white progress bar, percentage text)

Continue Button:
- Button/Primary/Large, "Continue" label, full-width
- Fixed to bottom
- Disabled until at least 1 photo uploaded

---

STEP 2: Details (auto-detected category pre-filled)

Form Section (auto-layout vertical, 16px gap, scrollable):

Category Field:
- Label: "Category" (Body/Regular-Medium, gray-900, required asterisk)
- Selected value display (Form-Input/Default appearance, chevron-right icon):
  - Shows auto-detected category: "Clothing > Boys > Outerwear"
  - Green checkmark icon (16px) if auto-detected, gray question icon if manual
  - Tap to open CategoryPicker modal

Title Field:
- Label: "Title" (Body/Regular-Medium, gray-900, required asterisk)
- Auto-suggested value (pre-filled, gray-700 text): "Boys Winter Jacket"
- "Suggested" tag (teal-100 bg, teal-700 text, 6px radius, 6px padding, Body/Small)
- Character count: "23/80" (Body/Small, gray-500)

Description Field:
- Label: "Description (Optional)" (Body/Regular-Medium, gray-900)
- Multi-line textarea (Form-Input/Default, 4 rows, placeholder: "Describe condition, size, features...")
- Character count: "0/500"

Condition Selector:
- Label: "Condition" (Body/Regular-Medium, gray-900, required asterisk)
- 4 chips (horizontal, wrap, 8px gap):
  - "New", "Like New", "Good", "Fair"
  - Unselected: white bg, gray-300 border
  - Selected: orange bg, white text, checkmark icon

Size Field (if category applicable):
- Label: "Size" (Body/Regular-Medium, gray-900)
- Dropdown (Form-Input/Default with chevron-down): Shows size options based on category
  - Clothing: "Newborn", "0-3M", ... "2T", "3T", "4T", "5", "6", "7", ...
  - Shoes: "0", "1", ... "7Y"

Brand Field:
- Label: "Brand (Optional)" (Body/Regular-Medium, gray-900)
- Autocomplete input (Form-Input/Default, magnifying glass icon)
- Placeholder: "Nike, Carter's, Gap..."
- Popular brand chips below (gray-100 bg): "Nike", "Carter's", "Gap", "Old Navy" (tap to select)

Continue Button (fixed to bottom)

---

STEP 3: Price

Pricing Calculator Section (card, white bg, gray-200 border, 12px radius, 16px padding):

Price Input (large, centered):
- Label: "Set Your Price" (Heading/H3, gray-900, centered)
- Currency input (72px height, centered, Heading/Display-1 orange):
  - "$" prefix (gray-500)
  - Amount input (placeholder "0")
  - Numeric keyboard
- Min price hint below: "Minimum $1" (Body/Small, gray-500, centered)

AI Price Suggestion (if available - future feature):
- Card (teal-50 bg, 8px radius, 12px padding):
  - Sparkle icon (20px, teal-600) + "Suggested Price" label (Body/Regular-Medium, teal-900)
  - Price range (Body/Large, teal-700): "$20 - $28"
  - "Based on similar items" (Body/Small, teal-600)

SP Earn Preview (auto-layout vertical, 16px gap, 24px below price input):
- "You'll Earn" label (Body/Regular-Medium, gray-700, centered)
- Large SP badge (orange circle bg, 64x64px, centered):
  - Coin icon (32px, white)
  - "250 SP" (Heading/H2, white)
- Calculation breakdown (Body/Small, gray-600, centered):
  - "Item Price: $24.00"
  - "Platform keeps: $0 (0% seller fee)"
  - "You earn: 250 SP (when buyer confirms)"

Subscription Requirement Banner (if applicable):
- Yellow-50 bg, yellow-600 border-left (4px), 12px padding, 8px radius
- Info icon (20px, yellow-600) + Text (Body/Regular, yellow-900):
  - "Active subscription required to earn SP on sales"
  - "Upgrade to Premium" link (orange, underline)

Fee Transparency Link:
- "How are fees calculated?" (Body/Small, orange, underline, centered)
- Tap opens FeeSummary modal

Continue Button (fixed to bottom)

---

STEP 4: Review & Publish

Preview Card (full listing preview as it will appear to buyers):
- Image carousel (375x375px, swipeable, page dots)
- Title (Heading/H2, gray-900): "Boys Winter Jacket Size 6"
- Price (Heading/Display-1, orange): "$24"
- SP earn badge (orange, small): "250 SP"
- Condition badge: "Like New"
- Category breadcrumb (Body/Small, gray-600): "Clothing > Boys > Outerwear"
- Description (Body/Regular, gray-700, 3 lines max, "Read more" link)

Safety Checks Section (auto-layout vertical, 12px gap):
- "Safety Checks" label (Body/Regular-Medium, gray-900)
- Check items (auto-layout vertical, 8px gap):
  - Green checkmark icon (20px) + "No recalls detected" (Body/Regular, gray-700)
  - Green checkmark + "Image moderation passed" (if completed)
  - Yellow spinner + "Image moderation in progress..." (if pending)
  - Red X + "CPSC recall detected - listing blocked" (if recall found)

Publish Section (fixed to bottom, white bg, shadow):
- Checkbox (16x16px, gray-300 border, orange check when selected):
  - "I confirm this item is in the condition described and complies with our Terms of Service" (Body/Small, gray-700)
- "Publish Listing" button (Button/Primary/Large, full-width, 12px below checkbox)
  - Disabled until checkbox selected and safety checks pass

Success State (show after publish):
- Confetti animation overlay
- Green checkmark (80x80px, green circle bg, white checkmark)
- "Listing Published!" (Heading/Display-1, gray-900, centered)
- "Your listing is now live and visible to buyers in your area" (Body/Large, gray-700, centered)
- Preview link: "View Listing" (Button/Secondary/Medium)
- "Create Another" button (Button/Primary/Large)
- "Go to My Listings" link (Body/Regular, orange, centered)

---
FIELD INVENTORY — ItemCreateScreen:

INPUT FIELDS (user-editable — across 4 steps):
Step 1 — Photos:
- Photos: up to 6 image uploads (camera or gallery), reorderable by drag, first = cover, required (min 1)
Step 2 — Details:
- Category: hierarchical picker, required, auto-suggested from AI photo analysis
- Title: text input, required, min 3 / max 80 chars (may be AI pre-filled)
- Description: textarea, optional, max 500 chars
- Condition: chip selector, required (New | Like New | Good | Fair), default Good
- Size: dropdown, optional, category-dependent
- Brand: autocomplete text input, optional (popular brand chips for quick-select)
- Colors: multi-select chips, optional
- Age Group: dropdown, optional (0-2 | 3-5 | 6-8 | 9-12 | 13+)
- Gender: dropdown, optional (Boy | Girl | Unisex)
Step 3 — Price:
- Price: numeric input, required, min $1 / max $10,000
- Accepts Swap Points: boolean toggle, optional (only visible if canAcceptSP = true)
Step 4 — Review:
- Confirmation checkbox: required (must agree to listing terms before publish)
- "Save Draft" link: available at any step

DISPLAY FIELDS (read-only):
- 4-step progress stepper: Photo → Details → Price → Review (highlights current step)
- AI-suggested title: pre-filled with "Suggested" teal tag (dynamic, conditional)
- Category auto-detected: green ✓ if AI matched, gray ? if manual
- Title character count: "X/80", updates live
- Description character count: "0/500", updates live
- SP earn preview: coin icon + "250 SP" calculated from price (dynamic)
- AI price suggestion: "$20–$28 based on similar items" (dynamic, conditional)
- Subscription banner: "Upgrade to Premium to earn SP" (conditional if !canAcceptSP)
- Safety checks: "No recalls detected" / "Moderation in progress" / "Recall blocked" (dynamic)
- Success state: confetti + "Listing Published!" (shown after publish)

AUTO-CALCULATED:
- AI category + title suggestions (useAIAnalysis hook from uploaded photo URLs)
- SP earn amount = price × SP rate (from admin config)
- canAcceptSP (from getSubscriptionSummary RPC)
- Draft auto-save every 30 seconds (useItemDraft hook)
- Final listing status = 'available' or 'pending' (from admin approval settings)
---

SCREEN 2: BulkListingCreateScreen
Frame: 375x812px, white background

Header:
- Back button (top-left)
- "Bulk Upload" title (Heading/H2, gray-900, centered)
- Help icon (top-right, 44x44px touch target, question mark icon)

Instructions Card (top, 16px padding, gray-50 bg, 8px radius):
- "Upload multiple photos at once" (Body/Regular-Medium, gray-900)
- "We'll group similar items and help you create listings faster" (Body/Regular, gray-600)

Bulk Photo Upload Area:
- Large upload zone (same as ItemCreateScreen, but supports multi-select)
- "Upload up to 30 photos" hint (Body/Small, gray-500)

Photo Grid (after upload, 3 columns, 8px gap):
- Photo thumbnails (110x110px each)
- Auto-grouped by visual similarity (AI-detected, future feature)
- Group indicator: Colored border (orange, teal, yellow for different groups)
- Select checkbox (top-left, 20x20px)

Grouped Items Section (after AI grouping):
- "We found [X] items" (Heading/H3, gray-900)
- Item cards (auto-layout vertical, 12px gap):
  - Card: white bg, gray-200 border, 12px radius, 16px padding
  - Photo thumbnails (horizontal scroll, 64x64px each)
  - Auto-detected category + title (pre-filled)
  - Quick edit fields: Price, Condition, Size
  - "Edit Details" link (Body/Small, orange)
  - Remove button (Button/Tertiary/Small, red text)

Batch Actions (fixed to bottom):
- "Set price for all: $__" input (200px width, left-aligned)
- "Set condition for all:" dropdown (right-aligned)
- "Publish All" button (Button/Primary/Large, full-width, 12px below batch inputs)

---
FIELD INVENTORY — BulkListingCreateScreen:

INPUT FIELDS (user-editable):
- Photos: up to 30 multi-select uploads from gallery, required (min 1)
- Per-item group: price (numeric, required), condition (chip-select, required), size (dropdown, optional)
- "Set price for all": numeric input, applies same price to all grouped items
- "Set condition for all": dropdown, applies same condition to all grouped items
- "Edit Details" link (per group): opens full edit view for that item
- Remove button (per group): removes item from bulk batch
- "Publish All" button: publishes all valid grouped items

DISPLAY FIELDS (read-only):
- Photo thumbnails grid (3 columns, 110×110px): color-bordered by AI group (dynamic)
- "We found [X] items" heading: AI-detected group count (dynamic)
- Per-group: auto-detected category + title + photo thumbnails (dynamic)
- Group color borders (orange, teal, yellow per group) (dynamic)

AUTO-CALCULATED:
- AI visual grouping of uploaded photos into item clusters
- Auto-detected category + title per group (AI analysis)
---

SCREEN 3: EditListingScreen
Frame: 375x812px, white background

Header:
- Back button (top-left)
- "Edit Listing" title (Heading/H2, gray-900, centered)
- Delete icon (top-right, 44x44px, trash icon, red on tap)

Form (same layout as ItemCreateScreen Step 2-3, but pre-filled):
- All fields pre-populated with existing values
- Photo grid shows current photos (can add/remove/reorder)
- "Save Changes" button (Button/Primary/Large, fixed to bottom)
- "Cancel" link (Body/Regular, gray-500, centered, above button)

Status Banner (if listing sold/expired):
- Gray-100 bg, gray-600 border-left (4px), 12px padding
- Info icon (20px, gray-600) + Text (Body/Regular, gray-700):
  - "This listing is sold. Changes will not be visible."
  - OR "This listing expired. Republish to make it live again."

Republish Button (if expired):
- Button/Secondary/Large, "Republish Listing" label
- 12px below Save Changes button

Delete Confirmation Modal (show when trash icon tapped):
- Modal/Full-Overlay component
- Warning icon (64x64px, red circle bg, white exclamation)
- "Delete Listing?" (Heading/H2, gray-900, centered)
- "This action cannot be undone. Your listing will be permanently deleted." (Body/Regular, gray-700, centered)
- "Delete" button (Button/Destructive/Large, full-width)
- "Cancel" button (Button/Secondary/Large, full-width, 12px below)

---
FIELD INVENTORY — EditListingScreen:

INPUT FIELDS (user-editable — same fields as ItemCreateScreen, all pre-filled):
- Photos: current photos shown, can add/remove/reorder, up to 6
- Category: hierarchical picker, pre-filled
- Title: text input, required, min 3 / max 80 chars, pre-filled
- Description: textarea, optional, max 500 chars, pre-filled
- Condition: chip selector, required, pre-filled
- Size: dropdown, optional, pre-filled
- Brand: autocomplete input, optional, pre-filled
- Colors: multi-select chips, optional
- Age Group: dropdown, optional (0-2 | 3-5 | 6-8 | 9-12 | 13+)
- Gender: dropdown, optional (Boy | Girl | Unisex)
- Price: numeric input, required, pre-filled
- Accepts Swap Points: boolean toggle, pre-filled
- Delete (trash icon): opens Delete Confirmation Modal

DISPLAY FIELDS (read-only):
- Pre-filled form data from DB (dynamic, from getListingById)
- Status banner: "This listing is sold." or "This listing expired." (conditional, gray)
- Republish button: conditional (visible only if listing is expired)
- Delete Confirmation Modal: warning icon + destructive confirm button (conditional)

AUTO-CALCULATED:
- Pre-fill from getListingById(listingId) RPC
- Ownership check: seller_id === session.user.id
- Re-approval triggered if major fields (category, title) changed
---

SCREEN 4: MyListingsScreen
Frame: 375x812px, white background

Header:
- "My Listings" title (Heading/H2, gray-900, left-aligned, 16px from left)
- Add listing button (top-right, 40x40px, orange circle bg, white plus icon)

Tabs (horizontal, below header, 16px horizontal padding):
- "Active" (default), "Sold", "Expired", "Drafts"
- Active tab: orange text + 2px bottom border (orange)
- Inactive: gray-600 text
- Count badge per tab: "(5)" (gray-500)

Listing Count:
- "5 active listings" (Body/Regular, gray-700, 16px from left, 12px below tabs)

Listing List (auto-layout vertical, 12px gap, scrollable):

Listing Card Component (reusable):
- Frame: full-width minus 32px padding, auto-height
- White bg, gray-200 border (1px), 12px radius, 12px padding
- Auto-layout horizontal, 12px gap:
  - Thumbnail (80x80px, 8px radius, image fill)
  - Content section (auto-layout vertical, 8px gap, flex-grow):
    - Title (Body/Regular-Medium, gray-900, 2 lines max): "Boys Winter Jacket Size 6"
    - Status row (horizontal, 4px gap):
      - Status badge (Status-Badge component): "Active" (green), "Sold" (gray), "Expired" (red), "Draft" (yellow)
      - Posted date (Body/Small, gray-600): "Posted 2d ago"
    - Price + SP row (horizontal, space-between):
      - Price (Body/Large-Medium, gray-900): "$24"
      - SP badge (orange, small): "250 SP"
    - Stats row (horizontal, 16px gap):
      - Views icon (16px, gray-500) + count (Body/Small, gray-600): "23"
      - Heart icon + favorites count: "5"
  - Actions menu (top-right, 32x32px, 3-dots icon, gray-500)

Actions Menu (show when 3-dots tapped):
- Modal/Action-Sheet component
- Options:
  - "Edit Listing" (pencil icon 20px)
  - "Mark as Sold" (checkmark icon) — if active
  - "Republish" (refresh icon) — if expired/sold
  - "Share Listing" (share icon)
  - "Delete" (trash icon, red text)

Empty State (no listings):
- Illustration (200x200px): Empty box (gray-400)
- "No listings yet" (Heading/H3, gray-700, centered)
- "Create your first listing to start selling" (Body/Regular, gray-600, centered)
- "Create Listing" button (Button/Primary/Large, centered)

Filter & Sort (top-right, below header):
- Filter icon (24px, gray-600, shows filter count badge if active)
- Sort dropdown (Body/Small, gray-600): "Newest" chevron-down

Bottom Tab Bar (same as DiscoverScreen)

---
FIELD INVENTORY — MyListingsScreen:

INPUT FIELDS (user-editable):
- Status filter tabs: single-select (All | Pending | Needs Edits | Rejected | Active | Sold | Drafts)
- "+ Create" FAB button: opens choice sheet (List One Item | Bulk Upload)
- 3-dot action menu (per listing card): Edit | Mark as Sold | Republish | Share | Delete
- Draft swipe-to-discard: swipe left gesture on draft cards
- Pull-to-refresh: RefreshControl gesture

DISPLAY FIELDS (read-only):
- Summary stats bar: total active, total sold, lifetime earnings (dynamic from getListingSummary RPC)
- Listing cards: thumbnail, title, status badge, price, SP badge, posted date, view count, favorite count (dynamic)
- Status badges: Pending (yellow) | Needs Edits (orange) | Rejected (red) | Active (green) | Sold (gray) | Draft (yellow)
- Tab count badges: "(5)" per tab (dynamic)
- Time ago: "2h ago", "3d ago" (dynamic, calculated)
- Empty state: illustration + "No listings yet" + Create Listing CTA (conditional)

AUTO-CALCULATED:
- getMyListings() filtered by selectedStatus RPC
- getListingSummary() for stats bar
- getActiveDrafts() for Drafts tab
- Time ago from created_at timestamp
---

SCREEN 5: ListingSafetyReviewScreen
Frame: 375x812px, white background

Alert Banner (top, full-width, no padding):
- Red-600 bg, 16px padding
- Alert icon (32px, white) + "Recall Alert" (Heading/H2, white)

Recall Details Card (16px padding, 16px below banner):
- White bg, red-200 border (2px), 12px radius, 16px padding
- "CPSC Recall Detected" (Heading/H3, red-900)
- Recall info (auto-layout vertical, 8px gap):
  - "Product:" + detected product name (Body/Regular, gray-900)
  - "Recall Date:" + date (Body/Regular, gray-700)
  - "Reason:" + reason text (Body/Regular, gray-700): "Choking hazard for children under 3"
  - "CPSC #:" + recall number (Body/Small, gray-600)

Item Preview Card (16px padding, 16px below recall details):
- "Your Listing" label (Body/Regular-Medium, gray-900)
- Item thumbnail (120x120px, centered)
- Title (Body/Large-Medium, gray-900, centered)
- Category + condition (Body/Small, gray-600, centered)

Remediation URL:
- "View Full Recall Details" link (Body/Regular, orange, underline, centered)
- Opens external browser to CPSC recall page

Action Section (fixed to bottom, white bg, shadow):
- "This listing has been automatically removed from search and cannot be sold." (Body/Regular, gray-700, 16px horizontal padding, centered)
- "Remove Listing" button (Button/Destructive/Large, full-width)
- "Appeal This Decision" link (Body/Small, orange, centered, 12px below button)

Appeal Modal (if Appeal tapped):
- Modal/Full-Overlay
- "Appeal Recall Detection" (Heading/H2, gray-900)
- "Why do you think this is incorrect?" textarea (Form-Input/Default, 4 rows)
- "Submit Appeal" button (Button/Primary/Large)
- Note: "Our team will review within 24 hours" (Body/Small, gray-600)

---
FIELD INVENTORY — ListingSafetyReviewScreen:

INPUT FIELDS (user-editable):
- "Remove Listing" button: permanently removes the recalled/rejected listing
- "Appeal This Decision" link: opens Appeal Modal
- Appeal reason: textarea, min 10 chars (in Appeal Modal)
- "Submit Appeal" button: submits appeal to admin (in Appeal Modal)
- "Submit for Re-Review" button: conditional, visible only if status = needs_edits

DISPLAY FIELDS (read-only):
- Recall alert banner: "Recall Alert" red header (static)
- CPSC recall details: product name, recall date, reason, CPSC ID number (dynamic from DB)
- Item thumbnail + title + category + condition (dynamic from DB)
- "View Full Recall Details" link: external CPSC.gov URL (dynamic)
- Block message: "This listing has been automatically removed from search" (static)
- Admin rejection reason/note (dynamic, from DB)
- Appeal count: number of appeals already submitted (dynamic)
- Flagged/rejected date (dynamic)
- Appeal status badge: "In Review" | "Rejected" | "Pending" (dynamic, conditional)

AUTO-CALCULATED:
- isRejected, isFlagged, needsEdits derived from listing.status field
- Appeal count from listing.appeal_count
- submitListingAppeal() or submitListingNeedsEditsReReview() RPC on submit
---

MODALS & COMPONENTS:

CategoryPicker Modal (hierarchical selector):
- Modal/Bottom-Sheet
- "Select Category" header
- Breadcrumb trail (if in subcategory): "All > Clothing > Boys" (chevron separators, tap to go back)
- Category list (auto-layout vertical, 8px gap):
  - Category row: Icon (24px) + Name (Body/Regular, gray-900) + Chevron-right (if has subcategories)
  - Tap category with children → drill down
  - Tap leaf category → select and close
- Search bar (top, pill shape): "Search categories..."

FeeSummary Modal:
- Modal/Full-Overlay
- "Fee Breakdown" (Heading/H2, gray-900, centered)
- Table (auto-layout vertical, 12px gap):
  - Row: Label (Body/Regular, gray-700) + Value (Body/Regular-Medium, gray-900)
  - "Item Price": "$24.00"
  - "Seller Fee": "$0.00 (0%)"
  - "Buyer Fee": "$1.20 - $1.92 (5-8%, tier-dependent)"
  - Divider (1px gray-300)
  - "You Receive": "$24.00" (green text)
  - "You Earn (SP)": "250 SP" (orange text)
- "Close" button (Button/Primary/Large)

---

NAVIGATION FLOW:
- ItemCreate: Photos → Details → Price → Review → Publish → Success → My Listings
- BulkCreate: Upload → Grouped Items → Edit Each → Publish All → My Listings
- Edit: My Listings → Edit Listing → Save → My Listings
- Safety: Recall detected (background) → Notification → ListingSafetyReview → Remove/Appeal

FIGMA-SPECIFIC REQUIREMENTS:

- AI Empowerment: Treat these requirements as a starting point. Please provide suggestions for UI/UX improvements, alternative screen layouts, or propose new screens if they create a more ideal user experience.
- AI Collaboration: Please ask clarification questions or push back on any requirements that do not make structural or UX sense.
- Dependencies: Call out any design or flow dependencies you encounter while reading the prompts.
- Recommendations: For any questions or pushback, please provide your specific recommendations for how to proceed.

- Prototype Configuration: Use "Smart Animate" for transitions (300ms ease-in-out)
- Prototype Configuration: Configure overflow scrolling for long content areas
- Prototype Configuration: Add bottom tab bar navigation to all applicable screens
- Prototype Configuration: Link all modal overlays to dismiss on background tap
- Prototype Configuration: Configure keyboard navigation for form flows
- Create stepper component with 4 steps (progress indicator)
- Photo grid with drag-and-drop prototype (simulate reorder)
- Upload progress overlay component
- Auto-suggested value variant for text inputs (green checkmark + "Suggested" tag)
- Listing card component with status variants (active/sold/expired/draft)
- Interactive prototype: step-by-step flow, photo upload simulation, success animation
- CategoryPicker as nested frames (simulate drill-down navigation)
- Use instance swap for interchangeable content (photos, categories)
- Create confetti animation or placeholder frame for success state
```

---

## FLOW-07: Cart & Bundling

**Priority**: P0 (Critical) — MVP-blocking, multi-item checkout

**Status**: 🚧 NEW DESIGN REQUIRED (not yet implemented in codebase)

```
Design the cart and multi-item checkout flow for Pass It Up. Reference app-overview.md, design-system.md, and screen-flow-mapping.md FLOW-07. This is a NET-NEW feature requiring full design.

SCREENS TO DESIGN (2 total):
1. CartScreen (cart list view)
2. CartCheckoutScreen (multi-item checkout)

Use design-system.md components, emphasize clarity for multi-item transactions, SP allocation strategy.

---

SCREEN 1: CartScreen
Frame: 375x812px, white background

Header:
- "Cart" title (Heading/H2, gray-900, left-aligned, 16px from left)
- Item count (Body/Regular, gray-600): "(3 items)"
- Clear cart icon (top-right, 44x44px, trash icon, gray-600)

Cart Items List (auto-layout vertical, 12px gap, scrollable):

Cart Item Card Component (reusable):
- Frame: full-width minus 32px padding, auto-height
- White bg, gray-200 border (1px), 12px radius, 12px padding
- Auto-layout horizontal, 12px gap:
  - Checkbox (20x20px, gray-300 border, orange check when selected) — for bulk actions
  - Thumbnail (80x80px, 8px radius, image fill)
  - Content section (auto-layout vertical, 8px gap, flex-grow):
    - Title (Body/Regular-Medium, gray-900, 2 lines max): "Boys Winter Jacket Size 6"
    - Seller info (horizontal, 4px gap):
      - Avatar (24x24px circle)
      - Seller name (Body/Small, gray-700): "Sarah M."
    - Condition + location (Body/Small, gray-600): "Like New • 3.2 mi"
    - Price (Body/Large-Medium, gray-900): "$24"
  - Remove button (top-right, 32x32px, X icon, gray-500)

Separator between items (1px gray-200 line)

Bulk Actions Bar (show when items selected):
- Fixed to top (below header), orange-50 bg, 16px padding
- Checkbox "Select all" (left) + selected count (Body/Small, gray-900): "2 selected"
- "Remove selected" link (right, Body/Small, red-600)

Subtotal Section (fixed to bottom, white bg, shadow-card, safe area insets):
- Auto-layout vertical, 16px padding, 12px gap:
  - Row: "Subtotal" (Body/Regular, gray-700) + "$72.00" (Body/Large-Medium, gray-900)
  - Row: "Platform Fees (estimated)" (Body/Regular, gray-700) + "$3.60 - $5.76" (Body/Regular, gray-700)
  - Info icon (16px, gray-500) + "Final fees vary by membership tier" (Body/Small, gray-500)
  - Divider (1px gray-300)
  - Row: "Total" (Heading/H3, gray-900) + "$75.60 - $77.76" (Heading/H3, orange)
  - "Checkout" button (Button/Primary/Large, full-width)

Empty State (no items in cart):
- Illustration (240x240px): Empty shopping cart (gray-400)
- "Your cart is empty" (Heading/H2, gray-700, centered)
- "Start browsing to add items" (Body/Regular, gray-600, centered)
- "Browse Items" button (Button/Primary/Large, centered, 200px width)

Saved for Later Section (optional, below cart items):
- "Saved for Later (2)" (Body/Regular-Medium, gray-900)
- Similar card layout, but "Move to Cart" button instead of remove

---
FIELD INVENTORY — CartScreen:

INPUT FIELDS (user-editable):
- Item checkboxes: per-item checkbox, multi-select, enables bulk actions row
- "Select All" checkbox: selects all cart items for bulk action
- Remove button (per item, X icon): removes single item from cart immediately
- "Remove selected" link (bulk actions bar): removes all checked items
- "Move to Cart" button (per saved-for-later item): moves item back to active cart
- "Clear Cart" button (trash icon, header): clears entire cart with confirmation
- "Checkout" button: advances to CartCheckoutScreen
- "Browse Items" button (empty state): navigates to DiscoverScreen

DISPLAY FIELDS (read-only):
- Cart item cards: thumbnail, title, seller avatar + name, condition + distance, price (dynamic from DB)
- Item count in header: "(3 items)" (dynamic)
- Subtotal: "$72.00" (dynamic, sum of all cart item prices)
- Platform fees estimate: "$3.60–$5.76" (dynamic, 5–8% tier-dependent range)
- Total estimate: "$75.60–$77.76" (dynamic)
- "Saved for Later (2)" section: items the buyer saved for later (dynamic)
- Bulk actions bar: "X selected" count + "Remove selected" link (dynamic, conditional on selections)
- Empty state: illustration + "Your cart is empty" + Browse Items CTA (conditional)

AUTO-CALCULATED:
- Subtotal: sum of all cart item prices
- Fee range: buyer subscription tier determines 5% (Pro) to 8% (Free) fee
- Total: subtotal + estimated fee range
---

SCREEN 2: CartCheckoutScreen
Frame: 375x812px, white background

Header:
- Back button (top-left)
- "Checkout" title (Heading/H2, gray-900, centered)
- Step indicator: "Step 1 of 2" (Body/Small, gray-600)

Section 1: Order Summary (collapsible):
- Section header (auto-layout horizontal, space-between, tappable):
  - "Order Summary" (Heading/H3, gray-900)
  - Chevron icon (16px, gray-600, points down when expanded, right when collapsed)
  - Item count badge: "3 items" (Body/Small, gray-600)

Expanded state:
- Item mini-cards (auto-layout vertical, 8px gap):
  - Compact card: Thumbnail (60x60px) + Title (Body/Regular, gray-900, 1 line) + Price (Body/Regular-Medium, orange)
  - No remove option (must go back to cart)

Collapsed state:
- Only header visible, shows total price on right: "$72.00" (Body/Large-Medium, gray-900)

Section 2: Payment Method (16px below order summary):
- "Payment Method" (Heading/H3, gray-900)
- Saved card display (if exists):
  - Card component: white bg, gray-200 border, 12px radius, 16px padding
  - Card brand icon (Visa/MC/Amex 32x20px) + masked number (Body/Regular, gray-700): "**** 4242"
  - "Change" link (Body/Small, orange, right-aligned)
- New card input (if no saved card):
  - Stripe card input component integration
  - Card number field (Form-Input/Default, card icon)
  - Expiry + CVC (horizontal, 2 fields, 12px gap)
  - ZIP code field

Section 3: Swap Points Application (16px below payment):
- "Apply Swap Points" (Heading/H3, gray-900)
- Available balance display (auto-layout horizontal, space-between):
  - "Available SP" (Body/Regular, gray-700)
  - SP badge (orange): "750 SP" + "~$7.50 value" (Body/Small, gray-500)

SP Allocation Strategy Toggle:
- Radio buttons (2 options, vertical, 12px gap):
  - Option 1 (default): "Apply evenly across all items" (Body/Regular, gray-900)
    - Explanation (Body/Small, gray-600): "Maximize your SP usage up to 30-70% per item (admin-configured)"
  - Option 2: "Choose per item" (Body/Regular, gray-900)
    - Explanation: "Customize SP amount for each item individually"

SP Allocation Display (if Option 1 selected):
- Auto-layout vertical, 8px gap, gray-50 bg, 12px padding, 8px radius:
  - Per-item breakdown:
    - Item name (Body/Small, gray-900) + SP allocated (Body/Small, orange): "250 SP ($2.50)"
  - Total SP used: "750 SP ($7.50)" (Body/Regular-Medium, orange)
  - SP remaining: "0 SP" (Body/Small, gray-600)

SP Allocation Display (if Option 2 selected):
- Per-item slider cards (auto-layout vertical, 12px gap):
  - Item card: Item name + price
  - Slider (0% to admin-configured max 30-70%):
    - Track: gray-200 bg
    - Filled: orange
    - Thumb: 24px circle, orange
  - Value display: "250 SP ($2.50) • 10% of price" (Body/Small, orange)

Section 4: Delivery Notes (optional, 16px below SP):
- "Delivery Notes (Optional)" (Heading/H3, gray-900)
- Textarea (Form-Input/Default, 3 rows, placeholder: "Add notes for sellers about pickup arrangements...")
- Hint (Body/Small, gray-600): "Note: Each seller will coordinate pickup separately"

Section 5: Price Breakdown (16px below delivery notes):
- Card (gray-50 bg, 12px padding, 8px radius):
  - Auto-layout vertical, 8px gap:
    - Row: "Subtotal (3 items)" + "$72.00" (Body/Regular, gray-700 + gray-900)
    - Row: "Platform Fees" + "$3.60 - $5.76" (Body/Regular)
    - Row: "Swap Points" + "-$7.50" (Body/Regular, orange + orange)
    - Divider (1px gray-300)
    - Row: "Total" + "$68.10 - $70.26" (Heading/H3, gray-900 + orange)
    - Info text (Body/Small, gray-500): "Final amount may vary based on your membership tier"

Terms & Disclaimer Section (16px below breakdown):
- Checkbox (16x16px, gray-300 border, orange check when selected):
  - "I agree to the Terms of Service and understand that:" (Body/Small, gray-700)
- Bullet points (Body/Small, gray-600, 8px gap):
  - "• Each item will be treated as a separate transaction"
  - "• SP will be held pending until each buyer confirms delivery"
  - "• I will coordinate pickup separately with each seller"
  - "• Refunds are processed per item, not as a bundle"
- "View Full Terms" link (Body/Small, orange, underline)

Confirm & Pay Button (fixed to bottom, white bg, shadow):
- Button/Primary/Large, "Confirm & Pay $68.10" label (shows min total), full-width
- Disabled until checkbox selected
- Lock icon (20px, white) for security

Disclaimer Modal (show when "View Full Terms" tapped):
- Modal/Full-Overlay component
- "Multi-Item Checkout Terms" (Heading/H2, gray-900)
- Scrollable content (Body/Regular, gray-700):
  - Explains each item is a separate trade
  - SP allocation and pending release per item
  - Individual pickup coordination
  - Refund policy per item
- "I Understand" button (Button/Primary/Large)

Success State (after payment processed):
- Navigate to multi-trade tracking screen (FLOW-08 variant)
- Show success modal:
  - Green checkmark (80x80px)
  - "Payment Successful!" (Heading/Display-1, gray-900, centered)
  - "You have 3 active trades" (Body/Large, gray-700, centered)
  - "View Trades" button (Button/Primary/Large)
  - "Continue Shopping" button (Button/Secondary/Large)

---
FIELD INVENTORY — CartCheckoutScreen:

INPUT FIELDS (user-editable):
- Order summary section toggle: tappable header to expand/collapse item list
- Payment method: saved card (tap "Change") or new Stripe card input (card number, expiry, CVC, ZIP)
- SP allocation strategy: radio button (Apply Evenly Across All Items | Choose Per Item)
- SP per-item slider (Option 2 only): 0% to admin-configured max per item
- Delivery notes: textarea, optional, placeholder "Add notes for sellers about pickup arrangements..."
- Terms checkbox: required, must be checked before Confirm & Pay enables
- "View Full Terms" link: opens Disclaimer Modal (scrollable multi-item checkout policy)
- "Confirm & Pay" button: processes payment for all cart items simultaneously
- "I Understand" button (Disclaimer Modal): closes modal

DISPLAY FIELDS (read-only):
- Order summary: mini item cards (thumbnail, title, price) when expanded (dynamic)
- Item count badge: "3 items" in section header (dynamic)
- Saved card: brand icon + "****4242" (dynamic, or Stripe card input if no card saved)
- SP available balance: "750 SP ~$7.50" (dynamic from sp_wallets)
- SP allocation preview: per-item SP amount breakdown (dynamic, updates with strategy/slider)
- SP remaining after purchase: "0 SP remaining" (dynamic)
- SP cap banner: "Maximum SP usage is X%" (conditional orange banner, shown if cap exceeded)
- Price breakdown card: subtotal, platform fees, SP discount, total (dynamic, updates live)
- "Final amount may vary based on your membership tier" disclaimer (static)
- Step indicator: "Step 1 of 2" (static)
- Success modal: "Payment Successful!" + "You have 3 active trades" (conditional, shown after payment)

AUTO-CALCULATED:
- SP allocation per item (even distribution or per-slider value)
- Total after SP discount
- Fee amount based on buyer's subscription tier
- Payment split: card charge + SP cash value
---

NAVIGATION FLOW:
- Item Detail → Add to Cart → Cart badge updates
- Cart → Checkout → Payment → SP Allocation → Confirm → Success → Active Trades
- Cart → Empty State → Browse Items → Discover

FIGMA-SPECIFIC REQUIREMENTS:

- AI Empowerment: Treat these requirements as a starting point. Please provide suggestions for UI/UX improvements, alternative screen layouts, or propose new screens if they create a more ideal user experience.
- AI Collaboration: Please ask clarification questions or push back on any requirements that do not make structural or UX sense.
- Dependencies: Call out any design or flow dependencies you encounter while reading the prompts.
- Recommendations: For any questions or pushback, please provide your specific recommendations for how to proceed.

- Prototype Configuration: Use "Smart Animate" for transitions (300ms ease-in-out)
- Prototype Configuration: Configure overflow scrolling for long content areas
- Prototype Configuration: Add bottom tab bar navigation to all applicable screens
- Prototype Configuration: Link all modal overlays to dismiss on background tap
- Prototype Configuration: Configure keyboard navigation for form flows
- Checkbox component for bulk selection (boolean property)
- Cart item card with remove animation (prototype fade-out)
- Collapsible section component (expanded/collapsed variants)
- SP allocation slider with real-time calculation (prototype)
- Per-item vs. even allocation variants (boolean property toggles view)
- Stripe card input component (placeholder, will integrate native component)
- Interactive prototype: add to cart animation, quantity updates, checkout flow
- Create subtotal calculation component (updates based on cart contents)
- Multi-item summary cards (compact variant of item card)
- Disclaimer modal with scrollable content
```

---

## FLOW-08: Trade Flow – Checkout & Transaction State Machine

**Priority**: P0 (Critical) — Transaction completion, funds/SP management

```
Design the single-item trade flow (checkout to completion). Reference app-overview.md Section 4 (business model, SP mechanics), design-system.md, and screen-flow-mapping.md FLOW-08 for state machine details.

SCREENS TO DESIGN (6 total):
1. TradeInitiationScreen (payment & checkout)
2. TradeDetailScreen
3. TradeListScreen
4. TradeTimelineScreen
5. TradeSuccessScreen
6. ActiveTradesScreen

Use design-system.md components, emphasize transaction transparency, clear state progression.

---

SCREEN 1: TradeInitiationScreen (Single-Item Checkout)
Frame: 375x812px, white background

Header:
- Back button (top-left)
- "Checkout" title (Heading/H2, gray-900, centered)

Item Summary Card (16px padding):
- White bg, gray-200 border (1px), 12px radius, 16px padding
- Image (120x120px, 8px radius, centered)
- Title (Body/Large-Medium, gray-900, centered, 2 lines max)
- Condition badge (centered below title): "Like New"
- Seller info (horizontal, centered, 8px gap):
  - Avatar (32x32px circle) + Name (Body/Regular, gray-900) + Rating (⭐ 4.8)

Payment Section (16px below item card):
- "Payment Method" (Heading/H3, gray-900)
- Saved card or new card input (same as CartCheckoutScreen)

Swap Points Section (16px below payment):
- "Use Swap Points" (Heading/H3, gray-900)
- Available balance (auto-layout horizontal, space-between):
  - "Available: 750 SP" (Body/Regular, gray-700)
  - "~$7.50 value" (Body/Small, gray-500)

SP Slider:
- Label: "Apply SP to this purchase" (Body/Regular-Medium, gray-900)
- Slider (0% to admin-configured max 30-70% of item price):
  - Track: gray-200 bg, 4px height
  - Filled track: orange
  - Thumb: 24px circle, white bg, orange border, shadow
  - Value markers below: 0%, 25%, 50%, Max (admin-configured)
- SP amount display (real-time):
  - Large text (Heading/H2, orange, centered): "250 SP"
  - Cash equivalent below (Body/Regular, gray-600): "$2.50 • 10% of total"
  - Remaining SP (Body/Small, gray-500): "500 SP remaining after purchase"

SP Cap Explanation (if user tries to exceed):
- Info banner (orange-50 bg, orange border-left 4px, 12px padding):
  - Info icon (20px, orange-600) + Text (Body/Small, orange-900):
    - "Maximum SP usage is [30-70%] of purchase price (admin-configured)"

Price Breakdown Section (16px below SP):
- Card (gray-50 bg, 12px padding, 8px radius):
  - Auto-layout vertical, 8px gap:
    - Row: "Item Price" + "$24.00"
    - Row: "Platform Fee (5-8%)" + "$1.20 - $1.92" (tier-dependent)
    - Row: "Swap Points" + "-$2.50" (orange text)
    - Divider (1px gray-300)
    - Row: "Total Due" + "$22.70 - $23.42" (Heading/H3, gray-900 + orange)
    - Payment breakdown: "Card: $20.20 - $20.92 • SP: 250" (Body/Small, gray-600)

Disclaimer Section (16px below breakdown):
- Checkbox (16x16px, required):
  - "I agree to the Terms of Service and Pass It Up's Trading Policy" (Body/Small, gray-700)
  - "View Terms" link (orange, underline)
- Buyer protection note (Body/Small, gray-600):
  - "• Meet in safe public location"
  - "• Inspect item before marking complete"
  - "• Your payment is held securely until you confirm delivery"

Confirm & Pay Button (fixed to bottom):
- Button/Primary/Large, "Confirm & Pay $22.70" (shows min total), full-width
- Lock icon (20px, white) + "Secure Payment" label
- Disabled until disclaimer checked

DisclaimerModal (full terms):
- Modal/Full-Overlay
- "Trading Policy" (Heading/H2, gray-900)
- Scrollable content:
  - Safe meetup guidelines
  - Inspection requirements
  - SP pending/release mechanics
  - Dispute process
  - Refund policy
- "I Understand" button (Button/Primary/Large)

---
FIELD INVENTORY — TradeInitiationScreen:

INPUT FIELDS (user-editable):
- Payment method: saved card (tap "Change") or new Stripe card input (card number, expiry, CVC, ZIP)
- SP slider: 0% to admin-configured max (30–70% of item price)
- Disclaimer checkbox: required, must agree to Trading Policy before paying
- "View Terms" link: opens DisclaimerModal (safe meetup + SP mechanics)
- "Confirm & Pay" button: processes payment, creates trade record
- "I Understand" button (DisclaimerModal): closes modal

DISPLAY FIELDS (read-only):
- Item summary card: image, title, condition badge, seller avatar + name + star rating (dynamic from DB)
- SP available balance: "750 SP ~$7.50" (dynamic from sp_wallets)
- SP amount live display: "250 SP" + "$2.50 • 10% of total" (dynamic, updates with slider position)
- SP remaining after purchase: "500 SP remaining after purchase" (dynamic)
- SP cap explanation banner (conditional, orange): "Maximum SP usage is X% of purchase price" (shown if cap approached)
- Price breakdown card: item price, platform fee (5–8%), SP discount, total due, card + SP split (dynamic, updates live)
- Buyer protection bullet points: safe meetup, inspect before confirming, payment held securely (static)

AUTO-CALCULATED:
- SP spend amount: slider position × item price
- Total due: item price + platform fee − SP cash value
- Card charge: total due − SP cash value
- Platform fee based on buyer's subscription tier (5% Pro / 8% Free)
---

SCREEN 2: TradeDetailScreen
Frame: 375x812px, white background

Header:
- Back button (top-left)
- "Trade Details" title (Heading/H2, gray-900, centered)
- More menu (top-right, 3-dots icon, gray-600)

Trade Status Card (top, 16px padding):
- Status badge (large, centered): "In Progress" (yellow-100 bg, yellow-800 text, 6px radius, 12px padding)
- Trade ID below (Body/Small, gray-500, monospace font): "TXN-A1B2C3D4"
- Date created (Body/Small, gray-600): "May 4, 2026 at 2:30 PM"

Item Info Section (16px below status):
- Item image (120x120px, centered, 8px radius)
- Title (Body/Large-Medium, gray-900, centered)
- Price (Heading/H2, orange, centered): "$24.00"
- Condition badge (centered)

Parties Section (auto-layout vertical, 16px gap, 16px below item):
- "Buyer" card:
  - Label (Body/Small, gray-600): "Buyer"
  - Avatar (48x48px) + Name (Body/Large-Medium, gray-900) + Rating (⭐ 4.9)
  - "Message" button (Button/Tertiary/Small, message icon)
- "Seller" card (same layout)

Transaction Details Section:
- Card (white bg, gray-200 border, 12px radius, 16px padding):
  - Auto-layout vertical, 8px gap:
    - Row: "Item Price" + "$24.00"
    - Row: "Platform Fee" + "$1.20"
    - Row: "SP Applied" + "-$2.50" (orange)
    - Divider
    - Row: "Total Paid" + "$22.70" (Heading/H3, orange)
    - Row: "Payment Method" + "Visa ****4242" (Body/Small, gray-600)
    - Row: "SP Deducted" + "250 SP (pending)" (Body/Small, yellow-700)

Timeline Link:
- "View Trade Timeline →" (Body/Regular, orange, underline, centered, 16px below details)

Actions Section (fixed to bottom, white bg, shadow):
- Current state determines buttons shown:
  
  IF buyer, state = in_progress:
  - "Mark as Complete" button (Button/Primary/Large, full-width)
  - "Message Seller" button (Button/Secondary/Medium, full-width, 12px below)
  - "Report Issue" link (Body/Small, red-600, centered)
  
  IF seller, state = in_progress:
  - "Mark as Complete" button (Button/Primary/Large)
  - "Message Buyer" button (Button/Secondary/Medium)
  
  IF state = seller_marked_completed (waiting for buyer):
  - Info banner: "Seller marked this complete. Confirm when you receive the item." (yellow-50 bg)
  - "Confirm Received" button (Button/Primary/Large)
  - "Report Issue" link
  
  IF state = completed:
  - "Trade Complete" checkmark (green, disabled state)
  - "Rate [Other Party]" button (Button/Secondary/Large)
  - "Download Receipt" link (Body/Small, orange)

More Menu Options (when 3-dots tapped):
- Modal/Action-Sheet
- "View Timeline" (timeline icon)
- "Download Receipt" (download icon)
- "Share Trade" (share icon)
- "Report Issue" (flag icon, red text) — if not completed
- "Contact Support" (support icon)

---
FIELD INVENTORY — TradeDetailScreen:

INPUT FIELDS (user-editable):
- "Mark as Complete" button (buyer or seller, state = in_progress): advances trade state
- "Confirm Received" button (buyer only, state = seller_marked_completed): sets state → completed
- "Message Buyer" / "Message Seller" button: opens ConversationDetailScreen (FLOW-13)
- "Report Issue" link: opens issue/dispute report flow
- "Rate [Other Party]" button (state = completed): opens Rating Modal (star selector + review)
- "Download Receipt" link (state = completed): generates/downloads PDF receipt
- More menu (3-dots icon): View Timeline | Download Receipt | Share Trade | Report Issue | Contact Support
- "View Trade Timeline →" link: navigates to TradeTimelineScreen

DISPLAY FIELDS (read-only):
- Trade status badge: In Progress (yellow) | Waiting for You (orange) | Completed (green) | Cancelled (red) (dynamic)
- Trade ID: "TXN-A1B2C3D4" (monospace font, dynamic)
- Created date: "May 4, 2026 at 2:30 PM" (dynamic)
- Item image + title + price + condition badge (dynamic from DB)
- Buyer and seller cards: avatar, display name, star rating (dynamic from DB)
- Transaction details: item price, platform fee, SP applied, total paid, payment method, SP deducted (pending/released) (dynamic)
- State-specific info banner: "Seller marked complete. Confirm when you receive the item." (conditional, yellow, dynamic)
- Action buttons change based on trade.status + user role (buyer/seller) (dynamic)

AUTO-CALCULATED:
- Trade state machine: created → payment_confirmed → in_progress → seller_marked_completed → completed
- Both parties must mark complete for state = completed
- SP released from pending → available after both sides confirm
---

SCREEN 3: TradeListScreen (variant of ActiveTradesScreen - see Screen 6)

---

SCREEN 4: TradeTimelineScreen
Frame: 375x812px, white background

Header:
- Back button (top-left)
- "Trade Timeline" title (Heading/H2, gray-900, centered)
- Trade ID subtitle (Body/Small, gray-600): "TXN-A1B2C3D4"

Timeline (vertical, auto-layout, 16px horizontal padding):

Timeline Step Component (reusable, 5 steps total):
- Auto-layout horizontal, 16px gap:
  - Left column (fixed width 40px):
    - Step circle (32px diameter):
      - Completed: orange bg (#FF6B35), white checkmark icon (20px)
      - Current: orange border (2px), white bg, orange pulse animation
      - Pending: gray-200 bg, gray-400 icon
    - Connector line below (2px width, extends to next step):
      - Completed: orange
      - Pending: gray-200
      - No line on last step
  - Right column (flex-grow):
    - Step label (Body/Regular-Medium, gray-900 if completed/current, gray-500 if pending)
    - Timestamp (Body/Small, gray-600): "May 4, 2026 at 2:30 PM"
    - Description (Body/Regular, gray-700, 24px top margin): Additional context
    - Action button (if applicable): "View Receipt", "Contact Seller"

5 Timeline Steps:

STEP 1: Trade Created
- Label: "Trade Created"
- Description: "You initiated this trade and payment was processed"
- Details: "Payment: $22.70 • SP Applied: 250 (pending)"
- Always completed (past)

STEP 2: Payment Confirmed
- Label: "Payment Confirmed"
- Description: "Your payment was successfully processed"
- Details: "Transaction ID: ch_1A2B3C4D5E6F"
- Always completed (past)

STEP 3: In Progress
- Label: "Awaiting Completion"
- Description: "Coordinate pickup with [Seller Name] and inspect the item"
- Details: "Next: Both parties mark complete when item is received"
- Current step (if state = in_progress)

STEP 4: Seller Marked Complete
- Label: "Seller Confirmed"
- Description: "[Seller Name] marked this trade as complete"
- Details: "Waiting for you to confirm delivery"
- Current step (if state = seller_marked_completed)
- Action: "Confirm Received" button (Button/Primary/Medium)

STEP 5: Trade Completed
- Label: "Trade Complete"
- Description: "Both parties confirmed. Your SP has been released."
- Details: "250 SP moved from pending to available"
- Celebration icon (confetti, green circle bg)
- Action: "Download Receipt" link (orange)
- Only completed if state = completed

Next Action Banner (fixed to bottom, if not completed):
- Orange-50 bg, 16px padding, shadow
- Icon (24px, orange) + Text (Body/Regular-Medium, orange-900):
  - "Action Required: Mark trade as complete when you receive the item"
- CTA button (Button/Primary/Large, full-width, 8px below text)

---
FIELD INVENTORY — TradeTimelineScreen:

INPUT FIELDS (user-editable):
- "Confirm Received" action button (Step 4, buyer + state = seller_marked_completed): advances trade to completed
- "Download Receipt" link (Step 5, state = completed): downloads PDF receipt
- Bottom action banner CTA button: "Mark as Complete" or "Confirm Received" (conditional, based on pending action)

DISPLAY FIELDS (read-only):
- Trade ID subtitle: "TXN-A1B2C3D4" (dynamic, monospace)
- 5-step timeline: step circles (orange filled = completed, orange pulse = current, gray = pending), connector lines, step labels, timestamps, descriptions (all dynamic)
  - Step 1 (Trade Created): payment amount + SP applied (dynamic)
  - Step 2 (Payment Confirmed): Stripe transaction ID (dynamic)
  - Step 3 (Awaiting Completion): seller name hint for coordination (dynamic)
  - Step 4 (Seller Confirmed): "Waiting for you to confirm delivery" (conditional, dynamic)
  - Step 5 (Trade Complete): SP released badge + Download Receipt link (conditional, dynamic)
- Bottom action banner: "Action Required: Mark trade as complete when you receive the item" (conditional, only shown if action pending)

AUTO-CALCULATED:
- Step completion status derived from trade.status field
- Current active step determined by trade state machine position
---

SCREEN 5: TradeSuccessScreen (Celebration)
Frame: 375x812px, white background

Celebration Section (centered, 60% of screen):
- Confetti animation background (or static confetti graphic)
- Success icon (120x120px, green circle bg, white checkmark, centered)
- "Trade Complete!" (Heading/Display-1, gray-900, centered, 24px below icon)
- Message (Body/Large, gray-700, centered, 16px below heading):
  - "You successfully purchased [Item Name] from [Seller Name]"

Transaction Summary Card (16px horizontal padding, 24px below message):
- White bg, gray-200 border, 12px radius, 16px padding
- Auto-layout vertical, 8px gap:
  - Row: "Amount Paid" + "$22.70"
  - Row: "SP Applied" + "250 SP" (orange)
  - Row: "SP Status" + "Released to available" (green text)
  - Divider
  - Row: "New SP Balance" + "500 SP" (Heading/H3, orange)

Actions Section (fixed to bottom):
- "Rate [Seller Name]" button (Button/Primary/Large, full-width)
  - Star icons (5 stars, 32px each, tap to rate)
- "View Receipt" button (Button/Secondary/Large, full-width, 12px below)
- "Continue Shopping" link (Body/Regular, orange, centered, 12px below)

Rating Modal (show when "Rate" button tapped):
- Modal/Full-Overlay
- "Rate [Seller Name]" (Heading/H2, gray-900, centered)
- Avatar (64x64px, centered)
- Star rating input (5 stars, 40px each, tap to select, orange when filled)
- "Leave a review (optional)" textarea (Form-Input/Default, 3 rows)
- "Submit Rating" button (Button/Primary/Large)
- "Skip" link (Body/Small, gray-500, centered)

---
FIELD INVENTORY — TradeSuccessScreen:

INPUT FIELDS (user-editable):
- "Rate [Seller Name]" button: opens Rating Modal
- Rating Modal — star input: 1–5 star tap selector (required to submit)
- Rating Modal — review textarea: optional free text, 3 rows
- "Submit Rating" button (Rating Modal): submits rating to DB
- "Skip" link (Rating Modal): skips rating, closes modal
- "View Receipt" button: downloads/shows PDF receipt
- "Continue Shopping" link: navigates to DiscoverScreen

DISPLAY FIELDS (read-only):
- Confetti animation / success icon (green checkmark, 120×120px) (static)
- "Trade Complete!" heading (static)
- "You successfully purchased [Item Name] from [Seller Name]" (dynamic)
- Transaction summary card: amount paid, SP applied, SP status "Released to available", new SP balance (dynamic)
- SP release confirmation badge (green, dynamic)

AUTO-CALCULATED:
- New SP balance = previous available + released pending SP
- SP status change: pending → available after both parties confirm
---

SCREEN 6: ActiveTradesScreen
Frame: 375x812px, white background

Header:
- "My Trades" title (Heading/H2, gray-900, left-aligned, 16px from left)
- Filter icon (top-right, 24px, gray-600, badge shows active filter count)

Filter Tabs (horizontal, below header):
- "Active" (default), "Completed", "All"
- Active tab: orange text + 2px bottom border (orange)
- Inactive: gray-600 text
- Count badge per tab: "(3)" (gray-500)

Trade Count:
- "3 active trades" (Body/Regular, gray-700, 16px from left, 12px below tabs)

Trade List (auto-layout vertical, 12px gap, scrollable):

Trade Card Component (reusable):
- Frame: full-width minus 32px padding, auto-height
- White bg, gray-200 border (1px), 12px radius, 12px padding
- Auto-layout horizontal, 12px gap:
  - Thumbnail (80x80px, 8px radius)
  - Content section (auto-layout vertical, 8px gap, flex-grow):
    - Title (Body/Regular-Medium, gray-900, 2 lines max)
    - Other party (horizontal, 4px gap):
      - Avatar (24x24px) + Name (Body/Small, gray-700)
      - Role label (Body/Small, gray-500): "Buyer" or "Seller"
    - Status row (horizontal, 8px gap):
      - Status badge: "In Progress" (yellow), "Waiting for You" (orange), "Completed" (green)
      - Date (Body/Small, gray-600): "May 4, 2026"
    - Price row (horizontal, space-between):
      - Amount (Body/Large-Medium, gray-900): "$22.70"
      - SP badge (if applicable, orange, small): "250 SP"
  - Chevron-right icon (24px, gray-400)

Action Required Banner (if applicable, top of card):
- Orange-50 bg, 8px padding, 6px radius
- Icon (16px, orange) + Text (Body/Small, orange-900): "Action required: Mark as complete"

Empty State (no trades):
- Illustration (200x200px): Empty box + handshake (gray-400)
- "No trades yet" (Heading/H3, gray-700, centered)
- "Start shopping to create your first trade" (Body/Regular, gray-600, centered)
- "Browse Items" button (Button/Primary/Large, centered)

Filter Modal (when filter icon tapped):
- Modal/Bottom-Sheet
- "Filter Trades" header
- Options (checkboxes, multi-select):
  - Status: "In Progress", "Waiting for Buyer", "Waiting for Seller", "Completed", "Cancelled"
  - Role: "As Buyer", "As Seller"
  - Date Range: "Last 7 days", "Last 30 days", "Last 90 days", "All time"
- "Apply" button (Button/Primary/Large)
- "Clear all" link (Body/Small, orange)

Bottom Tab Bar (same as DiscoverScreen)

---
FIELD INVENTORY — ActiveTradesScreen:

INPUT FIELDS (user-editable):
- Filter tabs: single-select (Active | Completed | All)
- Trade card tap: navigates to TradeDetailScreen
- Filter icon (header): opens Filter Modal
- Filter Modal: multi-select status (In Progress | Waiting for Buyer | Waiting for Seller | Completed | Cancelled) + role (As Buyer | As Seller) + date range
- "Browse Items" button (empty state): navigates to DiscoverScreen

DISPLAY FIELDS (read-only):
- Trade cards: thumbnail, title, other party avatar + name + role (Buyer/Seller), status badge, date, amount, SP badge (dynamic from DB)
- Status badges: In Progress (yellow) | Waiting for You (orange) | Completed (green) | Cancelled (red) (dynamic)
- "Action required: Mark as complete" banner (conditional per card, orange-50 bg, dynamic)
- Trade count: "3 active trades" (dynamic)
- Tab count badges: "(3)" per tab (dynamic)
- Empty state: illustration + "No trades yet" + Browse Items CTA (conditional)

AUTO-CALCULATED:
- getActiveTradesForUser() RPC filtered by selectedTab
- Role label (Buyer/Seller) from trades.buyer_id vs session.user.id
- "Action required" banner shown when trade.status = 'seller_marked_completed' AND current user is buyer
---

NAVIGATION FLOW:
- Item Detail → Buy Now → Trade Initiation → Payment → Success → Trade Detail
- Active Trades → Trade Detail → Timeline → Mark Complete → Success
- Trade Detail → Message (opens messaging) → Contact Seller
- Trade Complete → Rate → Submit → Back to Active Trades

FIGMA-SPECIFIC REQUIREMENTS:

- AI Empowerment: Treat these requirements as a starting point. Please provide suggestions for UI/UX improvements, alternative screen layouts, or propose new screens if they create a more ideal user experience.
- AI Collaboration: Please ask clarification questions or push back on any requirements that do not make structural or UX sense.
- Dependencies: Call out any design or flow dependencies you encounter while reading the prompts.
- Recommendations: For any questions or pushback, please provide your specific recommendations for how to proceed.

- Prototype Configuration: Use "Smart Animate" for transitions (300ms ease-in-out)
- Prototype Configuration: Configure overflow scrolling for long content areas
- Prototype Configuration: Add bottom tab bar navigation to all applicable screens
- Prototype Configuration: Link all modal overlays to dismiss on background tap
- Prototype Configuration: Configure keyboard navigation for form flows
- SP slider with real-time calculation (interactive prototype)
- Timeline component with 5 steps, pulse animation on current step
- Trade state variants (in_progress, seller_marked_completed, completed, cancelled)
- Celebration animation or confetti graphic for success screen
- Star rating component (interactive, tap to select 1-5 stars)
- Status badge variants (in_progress, waiting, completed, cancelled)
- Disable/enable states for action buttons based on trade state
- Interactive prototype: checkout flow, mark complete, rating submission
- Create receipt PDF preview (optional, can be static placeholder)
- Trade card component with conditional action banner
- Modal disclaimer with scrollable terms
```

---

## 🛑 50% CHECKPOINT — PLEASE REVIEW

I've now completed **8 prompts total** (50% progress):

✅ **Phase 1 (25%)**:
- FLOW-00: Design System & Component Library
- FLOW-01: Authentication (7 screens)
- FLOW-02: Onboarding (5 screens)
- FLOW-03: Location (2 screens)
- FLOW-06: Discovery (3 screens + modal)

✅ **Phase 2 (25% → 50%)**:
- FLOW-04: Listings – Create/Edit/Delete (5 screens + modals) ⭐ Photo-first
- FLOW-07: Cart & Bundling (2 screens) ⭐ NEW MVP-blocking feature
- FLOW-08: Trade Flow (6 screens) ⭐ Transaction state machine

**Total screens designed**: ~40 screens + modals + components

**Key features in this batch**:
- Photo-first listing creation with progressive disclosure
- Bulk upload flow with AI grouping
- NEW cart/multi-item checkout with SP allocation strategies
- Complete trade lifecycle (checkout → completion → success)
- Transaction state machine with 5-step timeline

---

## FLOW-10: SP Wallet – Transaction History & Balance Management

**Priority**: P0 (Critical) — Core loyalty program visibility

```
Design the Swap Points wallet interface. Reference app-overview.md Section 4.1 (SP mechanics, earning/spending rules, subscription requirements), design-system.md, and screen-flow-mapping.md FLOW-10.

SCREENS TO DESIGN (3 total):
1. SpWalletScreen (balance & transaction history)
2. SpTransactionDetailScreen
3. SpBalanceBreakdownScreen

Use design-system.md components, emphasize transaction transparency, subscription tier visibility.

---

SCREEN 1: SpWalletScreen
Frame: 375x812px, white background

Header:
- "Swap Points" title (Heading/H2, gray-900, centered)
- Info icon (top-right, 44x44px, gray-600): Opens SpBalanceBreakdownScreen

Hero Balance Card (16px padding, gradient bg):
- Card: orange-to-teal gradient (45deg angle), 16px radius, 24px padding, shadow
- SP icon (large, 64x64px, white, centered): Custom coin/badge icon
- Current balance (Heading/Display-1, white, centered, bold): "1,250 SP"
- Cash equivalent (Body/Large, white/90% opacity, centered): "~$12.50 value"
- Active subscription badge (Body/Small, white bg/20% opacity, white text, pill shape):
  - "Pro Member" OR "Premium" OR "Free Trial Ends [Date]"
  - Icon: Crown (Pro), Star (Premium), Clock (Trial)

Balance Breakdown Link:
- "View Balance Details →" (Body/Regular, white, underline, centered, 12px below balance)

Quick Actions Row (16px below balance card):
- Auto-layout horizontal, 12px gap, scrollable if needed:
  - "Earn SP" button (Button/Secondary/Medium, flex-grow)
  - "Spend SP" button (Button/Primary/Medium, flex-grow)
  - "Learn More" button (Button/Tertiary/Medium, info icon)

Subscription Status Banner (if trial ending soon or no active subscription):
- Yellow-50 bg, yellow-600 border-left (4px), 12px padding, 16px below actions
- Warning icon (20px, yellow-700) + Text (Body/Small, yellow-900):
  - Trial: "Your trial ends in 5 days. Subscribe to keep earning SP."
  - No subscription: "Subscribe to start earning Swap Points on sales."
  - "View Plans" link (Body/Small, orange, underline)

Transaction History Section (16px below banner/actions):
- Section header (auto-layout horizontal, space-between):
  - "Transaction History" (Heading/H3, gray-900)
  - Filter button (Body/Small, gray-600, filter icon): "All Types" chevron-down

Filter Options (dropdown/modal):
- "All Types" (default)
- "Earned"
- "Spent"
- "Pending"
- "Expired"

Transaction List (auto-layout vertical, 12px gap, scrollable):

Transaction Card Component (reusable):
- Frame: full-width minus 32px padding, auto-height
- White bg, gray-200 border (1px), 12px radius, 16px padding
- Auto-layout horizontal, space-between:
  - Left section (auto-layout vertical, 4px gap):
    - Transaction type icon + label (Body/Regular-Medium, gray-900):
      - Earned: Green circle + "SP Earned"
      - Spent: Orange circle + "SP Spent"
      - Pending: Yellow circle + "SP Pending"
      - Expired: Red circle + "SP Expired"
    - Description (Body/Regular, gray-700): "Sale of Boys Winter Jacket"
    - Date/time (Body/Small, gray-500): "May 4, 2026 at 2:30 PM"
  - Right section (auto-layout vertical, 4px gap, right-aligned):
    - Amount (Body/Large-Medium):
      - Earned: "+250 SP" (green-600)
      - Spent: "-100 SP" (orange)
      - Pending: "+150 SP" (yellow-700)
      - Expired: "-50 SP" (red-600)
    - Status badge (if applicable): "Pending" (yellow-100 bg, yellow-800 text, pill)
    - Chevron-right icon (16px, gray-400): Tap to view details

Empty State (no transactions):
- Illustration (200x200px): Empty wallet/coin icon (gray-400)
- "No transactions yet" (Heading/H3, gray-700, centered)
- "Earn SP by selling items or receiving referrals" (Body/Regular, gray-600, centered)
- "Start Selling" button (Button/Primary/Large, centered)

Load More Button (bottom, if more transactions):
- "Load More Transactions" (Button/Tertiary/Large, centered)

Bottom Tab Bar (same as DiscoverScreen)

---
FIELD INVENTORY — SpWalletScreen:

INPUT FIELDS (user-editable):
- "Earn SP" quick action button: navigates to MyListingsScreen (create listing)
- "Spend SP" quick action button: navigates to DiscoverScreen
- "Learn More" quick action button: opens SP info/education modal
- Transaction type filter dropdown: All Types | Earned | Spent | Pending | Expired
- Transaction card tap: navigates to SpTransactionDetailScreen
- "View Balance Details →" link: navigates to SpBalanceBreakdownScreen
- "Load More Transactions" button: paginates next page of transactions
- "Start Selling" button (empty state): navigates to ItemCreateScreen
- "View Plans" link (subscription banner): navigates to SubscriptionUpgradeScreen

DISPLAY FIELDS (read-only):
- Hero balance card (gradient orange-to-teal): current SP total, cash equivalent (~$X.XX), subscription tier badge (dynamic from sp_wallets + subscription)
- Subscription status banner: trial ending warning or no-subscription prompt (conditional, dynamic)
- Transaction cards: type icon + label, description, date/time, ±SP amount, status badge (dynamic from DB)
- Amount color coding: Earned = green, Spent = orange, Pending = yellow, Expired = red (dynamic)
- Empty state: illustration + "No transactions yet" (conditional)

AUTO-CALCULATED:
- Total SP balance from sp_wallets.total_balance
- getSpTransactions() paginated, filtered by selected type
- Subscription tier from getSubscriptionSummary RPC
---

SCREEN 2: SpTransactionDetailScreen
Frame: 375x812px, white background

Header:
- Back button (top-left)
- "Transaction Details" title (Heading/H2, gray-900, centered)

Transaction Summary Card (16px padding):
- Amount (Heading/Display-1, centered):
  - Color based on type (green-600/orange/yellow-700/red-600)
  - "+250 SP" OR "-100 SP"
- Cash equivalent (Body/Large, gray-600, centered): "~$2.50"
- Status badge (large, centered, 12px below amount):
  - "Completed" (green-100 bg, green-800 text)
  - "Pending" (yellow-100 bg, yellow-800 text)
  - "Expired" (red-100 bg, red-800 text)

Transaction Details Section (16px below summary):
- Card (white bg, gray-200 border, 12px radius, 16px padding):
  - Auto-layout vertical, 12px gap:
    - Row: "Transaction ID" + "TXN-A1B2C3D4" (monospace, Body/Small, gray-700)
    - Row: "Date" + "May 4, 2026 at 2:30 PM" (Body/Regular, gray-900)
    - Row: "Type" + "SP Earned from Sale" (Body/Regular, gray-900)
    - Divider (1px gray-300)
    - Row: "Related Item" + item name (Body/Regular, orange, underline): Tap to view item
    - Row: "Related Trade" + trade ID (Body/Regular, orange, underline): Tap to view trade
    - Divider (1px gray-300)
    - Row: "Subscription Tier" + "Pro Member" (Body/Regular, gray-900)
    - Row: "Earning Rate" + "10% base + 3% Pro bonus" (Body/Small, gray-600)

Timeline Section (if SP pending):
- "SP Release Timeline" (Heading/H3, gray-900)
- Timeline component (auto-layout vertical, 16px gap):
  - Step 1 (completed): Green checkmark + "Sale Completed" + date
  - Step 2 (completed): Green checkmark + "Buyer Confirmed Delivery" + date
  - Step 3 (pending): Yellow clock + "SP Released (Est. [Date])" + countdown
  - Explanation (Body/Small, gray-600): "SP will be released 24-72 hours after buyer confirms delivery"

Expiration Warning (if SP expiring soon):
- Orange-50 bg, orange-600 border-left (4px), 12px padding
- Warning icon (20px, orange-700) + Text (Body/Small, orange-900):
  - "This SP will expire in 30 days. Spend it before [Date]!"

Actions Section (fixed to bottom):
- "Download Receipt" link (Body/Regular, orange, centered)
- "Report Issue" link (Body/Small, gray-600, centered, 12px below)

---
FIELD INVENTORY — SpTransactionDetailScreen:

INPUT FIELDS (user-editable):
- "Download Receipt" link: generates/downloads transaction receipt
- "Report Issue" link: opens issue report flow
- "View item" link (related item row): navigates to ItemDetailScreen
- "View trade" link (related trade row): navigates to TradeDetailScreen

DISPLAY FIELDS (read-only):
- SP amount: "+250 SP" or "-100 SP" with color coding (Earned = green, Spent = orange, Pending = yellow, Expired = red) (dynamic)
- Cash equivalent: "~$2.50" (dynamic)
- Status badge: Completed | Pending | Expired (dynamic)
- Transaction detail rows: ID (monospace), date, type, related item name (link), related trade ID (link), subscription tier, earning rate formula (dynamic from DB)
- SP release timeline (conditional, if pending): 3-step timeline with dates and estimated release (dynamic)
- Expiration warning banner (conditional, orange): "Expires in X days. Spend before [Date]!" (shown if expiring within 30 days)

AUTO-CALCULATED:
- SP release ETA: trade creation date + 24–72 hour release window
- Days until expiration: sp_transactions.expires_at − today
---

SCREEN 3: SpBalanceBreakdownScreen
Frame: 375x812px, white background

Header:
- Back button (top-left)
- "Balance Breakdown" title (Heading/H2, gray-900, centered)

Total Balance Card (16px padding):
- Same gradient hero card as SpWalletScreen
- Total SP (Heading/Display-1, white, centered): "1,250 SP"
- Cash equivalent (Body/Large, white/90% opacity, centered): "~$12.50 value"

Balance Components Section (16px below total):
- "Your SP Breakdown" (Heading/H3, gray-900, 16px horizontal padding)

Breakdown Cards (auto-layout vertical, 12px gap):

1. Available SP Card:
- White bg, green-200 border-left (4px), 12px radius, 16px padding
- Icon (32px, green-600, checkmark circle) + Label (Body/Regular-Medium, gray-900): "Available to Spend"
- Amount (Heading/H2, green-600): "750 SP"
- Description (Body/Small, gray-600): "Ready to use on your next purchase"

2. Pending SP Card:
- White bg, yellow-200 border-left (4px), 12px radius, 16px padding
- Icon (32px, yellow-700, clock) + Label (Body/Regular-Medium, gray-900): "Pending Release"
- Amount (Heading/H2, yellow-700): "400 SP"
- Description (Body/Small, gray-600): "From recent sales awaiting buyer confirmation"
- "View Pending Transactions" link (Body/Small, orange, underline)

3. Expiring Soon Card (if applicable):
- White bg, orange-200 border-left (4px), 12px radius, 16px padding
- Icon (32px, orange-600, alert triangle) + Label (Body/Regular-Medium, gray-900): "Expiring Soon"
- Amount (Heading/H2, orange): "100 SP"
- Description (Body/Small, gray-600): "Will expire in 30 days. Spend before [Date]!"
- "Spend Now" button (Button/Secondary/Medium)

4. Total Earned (Lifetime) Card:
- White bg, gray-200 border (1px), 12px radius, 16px padding
- Icon (32px, gray-600, trophy) + Label (Body/Regular-Medium, gray-900): "Total Earned (All Time)"
- Amount (Heading/H2, gray-900): "5,230 SP"
- Description (Body/Small, gray-600): "Since you joined Pass It Up"

Earning Potential Section (16px below breakdown):
- Card (teal-50 bg, 12px radius, 16px padding):
  - "Maximize Your Earnings" (Heading/H3, gray-900)
  - Auto-layout vertical, 8px gap:
    - Current rate (Body/Regular, gray-700): "Current earning rate: 10% base + 3% Pro bonus"
    - Subscription comparison:
      - Free: "0% (No earning)" (gray-600)
      - Premium: "10% base rate" (teal-700)
      - Pro: "10% base + 3% bonus" (orange)
    - "Upgrade Subscription" button (Button/Primary/Medium)

SP Spend Cap Reminder (16px below earning):
- Info banner (gray-100 bg, gray-400 border-left (4px), 12px padding):
  - Info icon (20px, gray-600) + Text (Body/Small, gray-700):
    - "You can spend up to 30-70% of purchase price using SP (admin-configured)"

---
FIELD INVENTORY — SpBalanceBreakdownScreen:

INPUT FIELDS (user-editable):
- "View Pending Transactions" link (Pending SP card): filters SpWalletScreen to Pending type
- "Spend Now" button (Expiring Soon card): navigates to DiscoverScreen
- "Upgrade Subscription" button (Earning Potential section): navigates to SubscriptionUpgradeScreen

DISPLAY FIELDS (read-only):
- Hero balance card (gradient): total SP + cash equivalent (dynamic from sp_wallets.total_balance)
- Available SP card (green border): spendable balance + "Ready to use" (dynamic from sp_wallets.available_balance)
- Pending SP card (yellow border): pending amount + "Awaiting buyer confirmation" (dynamic from sp_wallets.pending_balance)
- Expiring Soon card (orange border): amount + expiration date (conditional, dynamic — shown if any SP expires within 30 days)
- Total Earned Lifetime card: cumulative all-time SP earned (dynamic)
- Earning potential section: current earning rate + Free/Premium/Pro comparison table (dynamic based on tier + admin config)
- SP spend cap reminder: "Spend up to X%–X% of purchase price" (dynamic, admin-configured range)

AUTO-CALCULATED:
- All balance buckets from sp_wallets (available_balance, pending_balance, lifetime_earned)
- Expiring SP calculated from sp_transactions where expires_at within 30 days
- Current earning rate: base rate + subscription tier bonus from admin config
---

NAVIGATION FLOW:
- Bottom Tab → Wallet → View Balance → Transaction History → Transaction Detail
- Wallet → Balance Breakdown → View Pending Transactions → Transaction Detail
- Trade Success → SP Earned notification → Wallet updates

FIGMA-SPECIFIC REQUIREMENTS:

- AI Empowerment: Treat these requirements as a starting point. Please provide suggestions for UI/UX improvements, alternative screen layouts, or propose new screens if they create a more ideal user experience.
- AI Collaboration: Please ask clarification questions or push back on any requirements that do not make structural or UX sense.
- Dependencies: Call out any design or flow dependencies you encounter while reading the prompts.
- Recommendations: For any questions or pushback, please provide your specific recommendations for how to proceed.

- Prototype Configuration: Use "Smart Animate" for transitions (300ms ease-in-out)
- Prototype Configuration: Configure overflow scrolling for long content areas
- Prototype Configuration: Add bottom tab bar navigation to all applicable screens
- Prototype Configuration: Link all modal overlays to dismiss on background tap
- Prototype Configuration: Configure keyboard navigation for form flows
- Gradient hero card component (orange-to-teal, reusable)
- Transaction card variants (earned/spent/pending/expired with color coding)
- Expandable filter dropdown/modal
- Timeline component for pending SP release
- Breakdown cards with color-coded left borders
- Subscription tier badge variants (Free/Premium/Pro)
- Interactive prototype: filter transactions, tap to view details, view breakdown
- SP amount animations (optional: count-up effect on balance changes)
- Create status badge component with variants (completed/pending/expired)
```

---

## FLOW-11: SP Earn/Spend Logic – Calculation Display

**Priority**: P1 (High) — Core loyalty program mechanics

```
Design SP earning and spending calculation displays integrated into existing screens. Reference app-overview.md Section 4.1 (earning rates, spending caps, subscription tiers), design-system.md, and screen-flow-mapping.md FLOW-11.

COMPONENTS TO DESIGN (integrated into existing screens):
1. SP Earn Badge (on item cards & detail screens)
2. SP Spend Input (on checkout screens)
3. SP Calculation Tooltip
4. Subscription Tier Comparison Modal

Use design-system.md components, emphasize transparency of calculations, subscription value proposition.

---

COMPONENT 1: SP Earn Badge
Context: Displayed on item cards (DiscoverScreen, CategoryBrowseScreen) and ItemDetailScreen

Compact Badge (for item cards):
- Pill shape, orange-50 bg, orange-600 border (1px), 4px padding, 6px radius
- Star icon (12px, orange-600) + Text (Body/Small, orange-900): "Earn 250 SP"
- Position: Top-right corner of item image, slight overlap

Expanded Badge (for ItemDetailScreen):
- Card, orange-50 bg, 12px radius, 12px padding, 16px below price
- Auto-layout vertical, 4px gap:
  - Header row (auto-layout horizontal, space-between):
    - Star icon (20px, orange-600) + "Earn Swap Points" (Body/Regular-Medium, orange-900)
    - Info icon (16px, gray-600): Tap to show calculation tooltip
  - Amount (Heading/H3, orange): "250 SP (~$2.50)"
  - Calculation breakdown (Body/Small, gray-700):
    - "Based on $24 sale price"
    - "10% base rate + 3% Pro bonus"
  - Subscription note (if not subscribed):
    - "Subscribe to start earning SP" (Body/Small, gray-600)
    - "View Plans" link (Body/Small, orange, underline)

Calculation Tooltip Modal:
- Modal/Bottom-Sheet
- "SP Earning Calculation" (Heading/H3, gray-900)
- Table (auto-layout vertical, 8px gap):
  - Row: "Item Sale Price" + "$24.00"
  - Row: "Base Earning Rate (Premium)" + "10%"
  - Row: "Pro Bonus" + "3%"
  - Divider
  - Row: "Total Rate" + "13%"
  - Row: "You Earn" + "250 SP (~$2.50)" (orange, bold)
- Note (Body/Small, gray-600): "SP will be released 24-72 hours after buyer confirms delivery"
- "Got It" button (Button/Primary/Large)

---

COMPONENT 2: SP Spend Input
Context: Displayed on TradeInitiationScreen and CartCheckoutScreen

Inline Spend Control (for single-item checkout):
- Already designed in FLOW-08 TradeInitiationScreen SP slider
- Reuse that design here

Multi-Item Spend Control (for cart checkout):
- Already designed in FLOW-07 CartCheckoutScreen SP allocation
- Reuse that design here

SP Spend Cap Warning:
- Alert banner (orange-50 bg, orange-600 border-left (4px), 12px padding)
- Warning icon (20px, orange-700) + Text (Body/Small, orange-900):
  - "Maximum SP usage is 30-70% of purchase price (admin-configured by membership tier)"
  - "You can spend up to [calculated max] SP on this purchase"

SP Insufficient Balance:
- Alert banner (red-50 bg, red-600 border-left (4px), 12px padding)
- Alert icon (20px, red-700) + Text (Body/Small, red-900):
  - "Insufficient SP balance. You have 150 SP available."
  - "Earn More SP" link (Body/Small, orange, underline)

---

COMPONENT 3: Subscription Tier Comparison Modal
Context: Accessible from SpWalletScreen, ItemDetailScreen (if not subscribed), SubscriptionManagementScreen

Modal Content:
- Modal/Full-Overlay
- "Maximize Your SP Earnings" (Heading/H2, gray-900, centered)
- Subtitle (Body/Large, gray-700, centered): "Compare earning rates by subscription tier"

Comparison Table (16px padding):
- 3 columns (Free, Premium, Pro), auto-layout horizontal, equal width
- Column cards:

Free Column:
- Gray-100 bg, gray-300 border (1px), 12px radius, 16px padding
- "Free" (Heading/H3, gray-900, centered)
- "$0/month" (Body/Large, gray-700, centered)
- Features (auto-layout vertical, 8px gap, Body/Small, gray-700):
  - X icon (red) + "No SP earning"
  - Checkmark (green) + "Buy items"
  - Checkmark + "Spend SP"
  - X + "List items for sale"

Premium Column:
- Teal-50 bg, teal-600 border (2px), 12px radius, 16px padding, subtle glow
- "Premium" (Heading/H3, teal-900, centered)
- "$4.99/month" (Body/Large, teal-700, centered)
- "Most Popular" badge (top-center, teal-600 bg, white text, pill)
- Features (Body/Small, gray-900):
  - Star icon (orange) + "Earn 10% SP base rate"
  - Checkmark + "List unlimited items"
  - Checkmark + "Buy items"
  - Checkmark + "Spend SP (30-50% cap)"

Pro Column:
- Orange-50 bg, orange-600 border (2px), 12px radius, 16px padding, subtle glow
- "Pro" (Heading/H3, orange-900, centered)
- "$9.99/month" (Body/Large, orange-700, centered)
- "Best Value" badge (top-center, orange bg, white text, pill)
- Features (Body/Small, gray-900):
  - Star icon (orange) + "Earn 13% SP (10% + 3% bonus)"
  - Checkmark + "List unlimited items"
  - Checkmark + "Priority support"
  - Checkmark + "Spend SP (50-70% cap)"

Earning Example (16px below table):
- Card (gray-50 bg, 12px radius, 12px padding):
  - "Example: Selling a $24 item" (Body/Regular-Medium, gray-900)
  - Auto-layout vertical, 4px gap:
    - Free: "Earn 0 SP ($0)" (gray-600)
    - Premium: "Earn 240 SP (~$2.40)" (teal-700)
    - Pro: "Earn 312 SP (~$3.12)" (orange)

CTA Section (fixed to bottom):
- "Select Plan" buttons (auto-layout horizontal, 12px gap):
  - "Try Premium Free" (Button/Primary/Large, flex-grow)
  - "Go Pro" (Button/Secondary/Large, flex-grow)
- "Maybe Later" link (Body/Small, gray-600, centered, 12px below)

---

COMPONENT 4: SP Value Display
Context: Everywhere SP amounts are shown

Standard Format:
- SP amount (bold, orange): "250 SP"
- Cash equivalent (gray-600, smaller): "~$2.50" OR "(~$2.50)"
- Use 1 SP = $0.01 conversion (hardcoded)

Badge Format (for highlights):
- Pill shape, orange bg, white text, star icon
- "250 SP" + "$2.50 value" (two-line OR horizontal with separator)

---

NAVIGATION FLOW:
- Item Detail → See SP Earn Badge → Tap info icon → Calculation Tooltip
- Checkout → SP Spend Input → Adjust slider → See real-time calculation
- Wallet → Low/No SP → View Plans → Tier Comparison Modal → Subscribe
- Item Card → SP Earn Badge (compact, visual interest)

FIGMA-SPECIFIC REQUIREMENTS:

- AI Empowerment: Treat these requirements as a starting point. Please provide suggestions for UI/UX improvements, alternative screen layouts, or propose new screens if they create a more ideal user experience.
- AI Collaboration: Please ask clarification questions or push back on any requirements that do not make structural or UX sense.
- Dependencies: Call out any design or flow dependencies you encounter while reading the prompts.
- Recommendations: For any questions or pushback, please provide your specific recommendations for how to proceed.

- Prototype Configuration: Use "Smart Animate" for transitions (300ms ease-in-out)
- Prototype Configuration: Configure overflow scrolling for long content areas
- Prototype Configuration: Add bottom tab bar navigation to all applicable screens
- Prototype Configuration: Link all modal overlays to dismiss on background tap
- Prototype Configuration: Configure keyboard navigation for form flows
- SP earn badge component (compact + expanded variants)
- Calculation tooltip modal with breakdown table
- Subscription tier comparison cards (3 column layout)
- SP spend slider (already designed in FLOW-07/08)
- Warning/error banner variants (cap exceeded, insufficient balance)
- Interactive prototype: slider updates SP amount, tooltip shows calculation
- Create reusable SP value display component (amount + cash equivalent)
- Tier badge variants (Free/Premium/Pro with brand colors)

---
FIELD INVENTORY — SP Earn/Spend Components (FLOW-11):

SP Earn Badge (compact — on item cards):
INPUT FIELDS: none (display only)
DISPLAY FIELDS:
- "Earn X SP" pill badge (top-right of item image): SP amount calculated from price × earning rate (dynamic)
- Only displayed if seller has active subscription (canAcceptSP = true)

SP Earn Badge (expanded — on ItemDetailScreen):
INPUT FIELDS:
- Info icon tap: opens Calculation Tooltip Modal
DISPLAY FIELDS:
- "Earn X SP (~$X.XX)" amount (dynamic, orange)
- Calculation breakdown: "Based on $X price, X% base rate + X% tier bonus" (dynamic)
- Subscription note + "View Plans" link (conditional, if current user not subscribed)

Calculation Tooltip Modal:
INPUT FIELDS:
- "Got It" button: closes modal
DISPLAY FIELDS:
- Calculation table: item price, base rate, tier bonus, total rate, SP earned (all dynamic)
- "SP released 24–72 hours after buyer confirms delivery" note (static)

Subscription Tier Comparison Modal:
INPUT FIELDS:
- "Try Premium Free" button: navigates to SubscriptionUpgradeScreen (Premium pre-selected)
- "Go Pro" button: navigates to SubscriptionUpgradeScreen (Pro pre-selected)
- "Maybe Later" link: dismisses modal
DISPLAY FIELDS:
- 3-column tier table: Free / Premium / Pro feature lists with ✓/✗ icons (static)
- Earning example: "On a $24 sale: Free = 0 SP, Premium = 240 SP, Pro = 312 SP" (static)

SP Spend Slider (checkout — TradeInitiationScreen and CartCheckoutScreen):
INPUT FIELDS:
- Slider thumb: drag 0% to admin-configured max (30–70% of purchase price)
DISPLAY FIELDS:
- SP amount live: "X SP" + "$X.XX" cash equivalent (dynamic, updates with slider)
- SP remaining after: "X SP remaining" (dynamic)
- SP cap banner (conditional, orange): "Max SP usage is X%" (shown if cap reached)
- Insufficient balance banner (conditional, red): "You have X SP available" (shown if wallet balance insufficient)
---
```

---

## FLOW-12: Subscription Management

**Priority**: P1 (High) — Revenue driver, SP earning gatekeeper

```
Design subscription management screens. Reference app-overview.md Section 4.1 (Free/Premium/Pro tiers, trial period, earning rules), design-system.md, and screen-flow-mapping.md FLOW-12.

SCREENS TO DESIGN (4 total):
1. SubscriptionManagementScreen
2. SubscriptionUpgradeScreen
3. SubscriptionCancellationScreen
4. SubscriptionSuccessScreen

Use design-system.md components, emphasize value proposition, clear billing information.

---

SCREEN 1: SubscriptionManagementScreen
Frame: 375x812px, white background

Header:
- Back button (top-left)
- "Subscription" title (Heading/H2, gray-900, centered)

Current Plan Card (16px padding):
- Gradient card (based on tier):
  - Free: Gray-300 to gray-400
  - Premium: Teal-400 to teal-600
  - Pro: Orange-400 to orange-600
- 16px radius, 24px padding, shadow
- Tier badge (top-center, white bg/20% opacity, white text, pill):
  - Crown icon (Pro) OR Star icon (Premium) OR Lock icon (Free)
  - "Pro Member" OR "Premium" OR "Free Plan"
- Plan name (Heading/H2, white, centered): "Pro Membership"
- Price (Body/Large, white/90% opacity, centered): "$9.99/month"
- Status (Body/Regular, white/80% opacity, centered):
  - Active: "Active since May 4, 2026"
  - Trial: "Trial ends May 11, 2026 (7 days left)"
  - Cancelled: "Expires May 31, 2026"

Plan Benefits Section (16px below card):
- "Your Benefits" (Heading/H3, gray-900, 16px horizontal padding)
- Benefits list (auto-layout vertical, 12px gap):
  - Benefit card (white bg, gray-200 border, 12px radius, 16px padding):
    - Icon (32px, orange for Pro, teal for Premium) + Label (Body/Regular-Medium, gray-900)
    - Description (Body/Small, gray-600)
  
  Pro Benefits:
  - Star icon + "Earn 13% SP on Sales" → "10% base + 3% Pro bonus"
  - Tag icon + "List Unlimited Items" → "Sell as much as you want"
  - Chat icon + "Priority Support" → "Get help faster"
  - Percent icon + "Spend up to 70% SP" → "Maximum SP usage on purchases"
  
  Premium Benefits:
  - Star icon + "Earn 10% SP on Sales" → "Base earning rate"
  - Tag icon + "List Unlimited Items" → "Sell as much as you want"
  - Percent icon + "Spend up to 50% SP" → "SP usage on purchases"
  
  Free Benefits:
  - Cart icon + "Buy Items" → "Shop the marketplace"
  - Wallet icon + "Spend SP" → "Use earned SP (up to 30%)"
  - X icon (red) + "No Earning" → "Subscribe to earn SP from sales"
  - X icon + "Cannot List Items" → "Upgrade to start selling"

Billing Information Section (if subscribed, 16px below benefits):
- "Billing Information" (Heading/H3, gray-900, 16px horizontal padding)
- Card (white bg, gray-200 border, 12px radius, 16px padding):
  - Auto-layout vertical, 12px gap:
    - Row: "Payment Method" + card info (Visa **** 4242)
    - "Update Payment" link (Body/Small, orange, underline)
    - Divider
    - Row: "Next Billing Date" + "June 4, 2026"
    - Row: "Amount" + "$9.99"
    - "View Billing History" link (Body/Small, orange, underline)

Actions Section (fixed to bottom, white bg, shadow):
- If Free:
  - "Upgrade to Premium" button (Button/Primary/Large, full-width)
  - "Upgrade to Pro" button (Button/Secondary/Large, full-width, 12px below)
  - "Compare Plans" link (Body/Small, orange, centered, 12px below)

- If Premium:
  - "Upgrade to Pro" button (Button/Primary/Large, full-width)
  - "Compare Plans" link (Body/Small, orange, centered, 12px below)
  - "Cancel Subscription" link (Body/Small, red-600, centered, 12px below)

- If Pro:
  - "Manage Plan" button (Button/Secondary/Large, full-width)
  - "Cancel Subscription" link (Body/Small, red-600, centered, 12px below)

- If Trial:
  - "Subscribe Now" button (Button/Primary/Large, full-width)
  - "Trial ends in X days" text (Body/Small, gray-600, centered, above button)
  - "Cancel Trial" link (Body/Small, gray-600, centered, 12px below)

---
FIELD INVENTORY — SubscriptionManagementScreen:

INPUT FIELDS (user-editable):
- "Upgrade to Premium" button (Free plan): navigates to SubscriptionUpgradeScreen (Premium pre-selected)
- "Upgrade to Pro" button (Free/Premium plan): navigates to SubscriptionUpgradeScreen (Pro pre-selected)
- "Compare Plans" link: opens Subscription Tier Comparison Modal (FLOW-11)
- "Update Payment" link: opens Stripe payment method update sheet
- "View Billing History" link: navigates to billing history list
- "Manage Plan" button (Pro plan): opens plan management options (pause/downgrade)
- "Subscribe Now" button (Trial): navigates to SubscriptionUpgradeScreen
- "Cancel Subscription" link: navigates to SubscriptionCancellationScreen
- "Cancel Trial" link: navigates to SubscriptionCancellationScreen

DISPLAY FIELDS (read-only):
- Current plan card (gradient based on tier — gray=Free, teal=Premium, orange=Pro): tier badge icon, plan name, price, status + since/expires date (dynamic)
- Benefits list: feature cards with icons, labels, descriptions (tier-dependent) (dynamic)
- Billing info card: masked payment method, next billing date, amount (conditional, only if subscribed) (dynamic)
- Trial countdown: "Trial ends in X days" (conditional, if trial active) (dynamic)

AUTO-CALCULATED:
- getSubscriptionSummary() RPC for current tier, billing_period_end, trial_end
- Trial days remaining: subscription.trial_end − today
---

SCREEN 2: SubscriptionUpgradeScreen
Frame: 375x812px, white background

Header:
- Back button (top-left)
- "Choose Your Plan" title (Heading/H2, gray-900, centered)

Trial Banner (if eligible):
- Teal-50 bg, teal-600 border-left (4px), 12px padding, 16px horizontal padding
- Gift icon (20px, teal-700) + "Start with a 7-day free trial!" (Body/Regular-Medium, teal-900)

Plan Cards (auto-layout vertical, 16px gap, 16px padding):

1. Free Plan Card:
- Gray-100 bg, gray-300 border (1px), 12px radius, 16px padding
- "Free" (Heading/H2, gray-900)
- "$0/month" (Heading/H3, gray-700)
- "Forever" (Body/Small, gray-600)
- Divider (12px vertical margin)
- Features list (auto-layout vertical, 8px gap, Body/Regular, gray-700):
  - Checkmark (green, 20px) + "Buy items"
  - Checkmark + "Spend SP (up to 30%)"
  - X (red) + "No SP earning"
  - X + "Cannot list items"
- Current plan badge (if free): "Current Plan" (gray-600 bg, white text, pill, top-right)

2. Premium Plan Card:
- White bg, teal-600 border (3px), 12px radius, 16px padding, glow effect
- "Popular" badge (top-center, teal-600 bg, white text, pill, -12px offset)
- "Premium" (Heading/H2, teal-900)
- "$4.99/month" (Heading/H3, teal-700)
- "7-day free trial" (Body/Small, teal-600, if eligible)
- Divider
- Features list (Body/Regular, gray-900):
  - Star (orange) + "Earn 10% SP on sales"
  - Checkmark + "List unlimited items"
  - Checkmark + "Spend up to 50% SP"
  - Checkmark + "Standard support"
- "Select Premium" button (Button/Primary/Large, teal bg, full-width)
- Earning example (Body/Small, gray-600, centered): "Earn ~$2.40 on a $24 sale"

3. Pro Plan Card:
- White bg, orange-600 border (3px), 12px radius, 16px padding, glow effect
- "Best Value" badge (top-center, orange bg, white text, pill)
- "Pro" (Heading/H2, orange-900)
- "$9.99/month" (Heading/H3, orange-700)
- "7-day free trial" (Body/Small, orange, if eligible)
- Divider
- Features list (Body/Regular, gray-900):
  - Star (orange) + "Earn 13% SP (10% + 3% bonus)"
  - Checkmark + "List unlimited items"
  - Checkmark + "Spend up to 70% SP"
  - Checkmark + "Priority support"
  - Checkmark + "Early access to features"
- "Select Pro" button (Button/Primary/Large, orange bg, full-width)
- Earning example (Body/Small, gray-600, centered): "Earn ~$3.12 on a $24 sale"

Comparison Link:
- "View Detailed Comparison →" (Body/Regular, orange, underline, centered, 16px below cards)
- Opens full tier comparison modal (from FLOW-11)

Terms & Auto-Renewal Notice (16px below cards):
- Card (gray-50 bg, 12px padding, 8px radius):
  - Checkbox (16x16px, required): "I agree to the subscription terms"
  - Text (Body/Small, gray-700):
    - "Your subscription will auto-renew monthly until cancelled."
    - "You can cancel anytime from account settings."
    - "View Full Terms" link (orange, underline)

---
FIELD INVENTORY — SubscriptionUpgradeScreen:

INPUT FIELDS (user-editable):
- "Select Premium" button: initiates Premium subscription checkout (Stripe)
- "Select Pro" button: initiates Pro subscription checkout (Stripe)
- Terms checkbox: required before payment proceeds
- "View Full Terms" link: opens subscription terms
- "View Detailed Comparison →" link: opens Subscription Tier Comparison Modal (FLOW-11)
- Payment method: Stripe payment sheet (card number, expiry, CVC, billing ZIP)

DISPLAY FIELDS (read-only):
- Trial banner: "Start with a 7-day free trial!" (conditional, shown if isTrialEligible = true) (dynamic)
- Free plan card ($0/month): feature list with ✓/✗ icons (static)
- Premium plan card ($4.99/month): "Popular" badge, features, earning example (static)
- Pro plan card ($9.99/month): "Best Value" badge, features, earning example (static)
- "Current Plan" badge (on currently active tier card) (dynamic)
- Auto-renewal notice: "Subscription auto-renews monthly until cancelled." (static)
- First-charge date (conditional): "First charge on [date]" shown if trial eligible (dynamic)

AUTO-CALCULATED:
- isTrialEligible: true if user has never had a paid subscription
- Current plan badge placement from active subscription tier
---

SCREEN 3: SubscriptionCancellationScreen
Frame: 375x812px, white background

Header:
- Back button (top-left)
- "Cancel Subscription" title (Heading/H2, gray-900, centered)

Confirmation Card (16px padding):
- Warning icon (64x64px, yellow circle bg, white exclamation, centered)
- "Are you sure?" (Heading/H2, gray-900, centered, 16px below icon)
- Current plan info (Body/Large, gray-700, centered): "You're currently on the Pro plan"

What You'll Lose Section (16px below confirmation):
- "What happens when you cancel:" (Heading/H3, gray-900, 16px horizontal padding)
- Loss list (auto-layout vertical, 12px gap, 16px horizontal padding):
  - Card (red-50 bg, red-200 border-left (4px), 12px radius, 12px padding):
    - X icon (red, 24px) + Text (Body/Regular-Medium, red-900)
    - Description (Body/Small, gray-700)
  
  Loss items:
  - "Stop Earning SP" → "You'll no longer earn SP on sales after [expiration date]"
  - "Lose SP Bonus" → "Your 3% Pro bonus will be removed"
  - "Reduced SP Spending" → "SP spend cap reduced from 70% to 30%"
  - "Priority Support Removed" → "Back to standard support queue"

Retention Section (16px below losses):
- Card (teal-50 bg, 12px radius, 16px padding):
  - "Before you go..." (Heading/H3, gray-900)
  - "Keep your benefits until [expiration date]" (Body/Regular, gray-700)
  - "Downgrade instead?" offer:
    - "Switch to Premium for $4.99/month" (Body/Regular-Medium, teal-900)
    - "Still earn 10% SP and list unlimited items" (Body/Small, gray-600)
  - "Downgrade to Premium" button (Button/Secondary/Medium)

Cancellation Reason (optional, 16px below retention):
- "Help us improve (optional)" (Heading/H3, gray-900, 16px horizontal padding)
- Radio buttons (vertical, 12px gap):
  - "Too expensive"
  - "Not selling enough items"
  - "Don't use the features"
  - "Technical issues"
  - "Other" + textarea (if selected)

Actions Section (fixed to bottom):
- "Keep My Subscription" button (Button/Primary/Large, full-width)
- "Confirm Cancellation" button (Button/Destructive/Large, full-width, 12px below)
- Note (Body/Small, gray-600, centered, 12px below):
  - "Your benefits will remain active until [expiration date]"

---
FIELD INVENTORY — SubscriptionCancellationScreen:

INPUT FIELDS (user-editable):
- "Downgrade to Premium" button (if cancelling Pro): switches to Premium instead of cancelling
- Cancellation reason: radio button selector (Too expensive | Not selling enough | Don't use features | Technical issues | Other)
- "Other" reason: textarea, conditional (visible only when "Other" radio selected)
- "Keep My Subscription" button: dismisses cancellation, returns to SubscriptionManagementScreen
- "Confirm Cancellation" button (destructive): submits cancellation to Stripe, schedules plan expiry

DISPLAY FIELDS (read-only):
- Warning icon + "Are you sure?" heading (static)
- Current plan display: "You're currently on the Pro plan" (dynamic)
- "What You'll Lose" list: 4 loss cards (Stop Earning SP, Lose SP Bonus, Reduced SP Spending, Priority Support Removed) — content adapts to current tier (dynamic)
- Retention offer card: "Before you go..." + downgrade suggestion + benefits comparison (dynamic, tier-dependent)
- Expiration date note: "Your benefits will remain active until [date]" (dynamic from subscription.current_period_end)

AUTO-CALCULATED:
- Plan expiration date: subscription.current_period_end
- Loss item content adapts based on cancelling Pro vs. Premium
---

SCREEN 4: SubscriptionSuccessScreen
Frame: 375x812px, white background

Success Icon (centered, 24px from top):
- Green checkmark circle (80x80px) OR Confetti animation

Success Message (centered, 16px below icon):
- "Welcome to [Pro/Premium]!" (Heading/Display-1, gray-900)
- "Your subscription is now active" (Body/Large, gray-700)

Plan Summary Card (16px padding, 16px below message):
- Gradient card (teal for Premium, orange for Pro)
- 16px radius, 24px padding
- Plan name (Heading/H2, white, centered)
- Price (Body/Large, white/90% opacity, centered): "$9.99/month"
- Billing info (Body/Regular, white/80% opacity, centered):
  - Trial: "Your 7-day trial starts now. First charge on [date]"
  - Immediate: "Charged today. Next billing [date]"

What's Next Section (16px below card):
- "Start Using Your Benefits" (Heading/H3, gray-900, 16px horizontal padding)
- Action cards (auto-layout vertical, 12px gap):
  
  1. Earn SP Card:
  - White bg, orange-200 border-left (4px), 12px radius, 16px padding
  - Star icon (32px, orange) + "Start Earning SP" (Body/Regular-Medium, gray-900)
  - "List your first item and earn [10%/13%] SP" (Body/Small, gray-600)
  - "Create Listing" button (Button/Primary/Medium)
  
  2. View Wallet Card:
  - White bg, teal-200 border-left (4px), 12px radius, 16px padding
  - Wallet icon (32px, teal) + "View Your Wallet" (Body/Regular-Medium, gray-900)
  - "Check your SP balance and earning history" (Body/Small, gray-600)
  - "Open Wallet" button (Button/Secondary/Medium)
  
  3. Explore Card:
  - White bg, gray-200 border-left (4px), 12px radius, 16px padding
  - Compass icon (32px, gray-600) + "Explore the Marketplace" (Body/Regular-Medium, gray-900)
  - "Find great deals and start shopping" (Body/Small, gray-600)
  - "Browse Items" button (Button/Tertiary/Medium)

Actions (fixed to bottom):
- "Continue to App" button (Button/Primary/Large, full-width)
- "Manage Subscription" link (Body/Small, orange, centered, 12px below)

---
FIELD INVENTORY — SubscriptionSuccessScreen:

INPUT FIELDS (user-editable):
- "Create Listing" button (Earn SP action card): navigates to ItemCreateScreen
- "Open Wallet" button (View Wallet action card): navigates to SpWalletScreen
- "Browse Items" button (Explore action card): navigates to DiscoverScreen
- "Continue to App" button (fixed bottom): navigates to main app (DiscoverScreen)
- "Manage Subscription" link: navigates to SubscriptionManagementScreen

DISPLAY FIELDS (read-only):
- Success animation / confetti (static)
- "Welcome to [Pro/Premium]!" heading (dynamic, based on selected tier)
- "Your subscription is now active" subtitle (static)
- Plan summary card (gradient — teal for Premium, orange for Pro): plan name, price, billing info (dynamic)
- Trial first-charge date: "Your 7-day trial starts now. First charge on [date]" (conditional, dynamic)
- Immediate charge date: "Charged today. Next billing [date]" (conditional, dynamic)
- What's Next action cards: SP earning rate, wallet link, explore link (tier-dependent, dynamic)

AUTO-CALCULATED:
- SP earning rate displayed = tier base rate + bonus from admin config
- Billing dates from Stripe subscription object (trial_end or current_period_end)
---

NAVIGATION FLOW:
- Profile → Subscription Management → View current plan
- Free/Trial → Upgrade Screen → Select plan → Payment → Success → App
- Subscribed → Manage → Cancel → Retention → Confirm → Downgraded/Cancelled
- Item Create (blocked if free) → Upgrade prompt → Upgrade Screen

FIGMA-SPECIFIC REQUIREMENTS:

- AI Empowerment: Treat these requirements as a starting point. Please provide suggestions for UI/UX improvements, alternative screen layouts, or propose new screens if they create a more ideal user experience.
- AI Collaboration: Please ask clarification questions or push back on any requirements that do not make structural or UX sense.
- Dependencies: Call out any design or flow dependencies you encounter while reading the prompts.
- Recommendations: For any questions or pushback, please provide your specific recommendations for how to proceed.

- Prototype Configuration: Use "Smart Animate" for transitions (300ms ease-in-out)
- Prototype Configuration: Configure overflow scrolling for long content areas
- Prototype Configuration: Add bottom tab bar navigation to all applicable screens
- Prototype Configuration: Link all modal overlays to dismiss on background tap
- Prototype Configuration: Configure keyboard navigation for form flows
- Plan card component with tier variants (Free/Premium/Pro)
- Gradient hero cards (teal/orange based on tier)
- Tier badge variants (Popular/Best Value/Current Plan)
- Feature list component (checkmark/X icons, auto-layout)
- Retention offer card (downgrade option)
- Cancellation reason radio buttons
- Success animation or confetti frame
- Interactive prototype: plan selection, payment flow, success state
- Create billing info component (card display + edit)
- Comparison table modal integration (from FLOW-11)
```

---

## FLOW-13: Messaging & Coordination

**Priority**: P1 (High) — Seller-buyer communication, pickup coordination

```
Design the messaging interface for seller-buyer communication. Reference app-overview.md (local pickup coordination), design-system.md, and screen-flow-mapping.md FLOW-13.

SCREENS TO DESIGN (3 total):
1. ConversationsListScreen
2. ConversationDetailScreen
3. MessageComposeScreen (optional modal)

Use design-system.md components, emphasize safety, trade-contextual messaging.

---

SCREEN 1: ConversationsListScreen
Frame: 375x812px, white background

Header:
- "Messages" title (Heading/H2, gray-900, left-aligned, 16px from left)
- Unread count badge (top-right, orange circle bg, white text): "3"

Filter Tabs (horizontal, below header, 16px horizontal padding):
- "All" (default), "Buying", "Selling", "Unread"
- Active tab: orange text + 2px bottom border (orange)
- Inactive: gray-600 text
- Count badge per tab: "(5)" (gray-500)

Conversation List (auto-layout vertical, scrollable):

Conversation Card Component (reusable):
- Frame: full-width, auto-height
- White bg, swipe-able (delete action on left swipe)
- 16px padding, separator line (1px gray-200) between cards
- Auto-layout horizontal, 12px gap:
  - Avatar section (relative positioning):
    - User avatar (48x48px, circle)
    - Unread badge (if unread): 12px red circle, top-right overlap
  - Content section (flex-grow, auto-layout vertical, 4px gap):
    - Top row (auto-layout horizontal, space-between):
      - Name (Body/Regular-Medium, gray-900): Seller/buyer name
      - Timestamp (Body/Small, gray-500): "2h ago" OR "May 4"
    - Item context row (auto-layout horizontal, 4px gap):
      - Item thumbnail (24x24px, 4px radius)
      - Item title (Body/Small, gray-700, 1 line, ellipsis): "Boys Winter Jacket"
    - Last message preview (Body/Regular, gray-700 OR gray-900 if unread, 1 line, ellipsis):
      - "See you at 3pm tomorrow!"
    - Trade status badge (if applicable, Body/Small, pill shape):
      - "Pending Pickup" (yellow-100 bg, yellow-800 text)
      - "Completed" (green-100 bg, green-800 text)
      - "Cancelled" (red-100 bg, red-800 text)
  - Chevron-right icon (16px, gray-400)

Unread Indicator:
- Unread conversations: bold text (name + message), blue dot (8px) next to timestamp

Swipe Actions:
- Swipe left: Red "Delete" button (60px width, red-600 bg, white trash icon)
- Swipe right: Orange "Archive" button (60px width, orange bg, white archive icon)

Empty State (no conversations):
- Illustration (200x200px): Empty inbox/chat bubbles (gray-400)
- "No messages yet" (Heading/H3, gray-700, centered)
- "Start a conversation by asking a seller about an item" (Body/Regular, gray-600, centered)
- "Browse Items" button (Button/Primary/Large, centered)

Search Bar (top, below tabs):
- Pill shape, gray-100 bg, 44px height, search icon (left), placeholder: "Search messages..."
- Search active: white bg, gray-300 border

Bottom Tab Bar (same as DiscoverScreen, Messages tab active)

---
FIELD INVENTORY — ConversationsListScreen:

INPUT FIELDS (user-editable):
- Search bar: text input, placeholder "Search messages...", filters conversations by name or item
- Filter tabs: single-select (All | Buying | Selling | Unread)
- Conversation card tap: navigates to ConversationDetailScreen
- Swipe left (per card): reveals "Delete" action (red, removes conversation)
- Swipe right (per card): reveals "Archive" action (orange)
- Pull-to-refresh: RefreshControl gesture

DISPLAY FIELDS (read-only):
- Conversation cards: avatar, unread badge (red dot), sender name, timestamp, item thumbnail + title (24×24px), last message preview (1 line), trade status badge (dynamic from DB)
- Unread indicator: bold name + message text + blue dot next to timestamp (dynamic)
- Tab count badges: "(5)" per tab (dynamic)
- Unread count badge in header (dynamic)
- Empty state: illustration + "No messages yet" + Browse Items CTA (conditional)

AUTO-CALCULATED:
- getConversations() filtered by tab (buying/selling) and unread status
- Unread count: conversations where last_read_at < last_message_at
---

SCREEN 2: ConversationDetailScreen
Frame: 375x812px, white background

Header:
- Back button (top-left)
- User info (centered):
  - Avatar (32x32px circle) + Name (Body/Regular-Medium, gray-900)
  - Rating (Body/Small, gray-600): "⭐ 4.8 (24 reviews)"
- More menu (top-right, 3-dots icon): Report, Block, Archive

Trade Context Banner (below header, full-width):
- Teal-50 bg, 12px padding, horizontal layout:
  - Item thumbnail (60x60px, 8px radius)
  - Auto-layout vertical, 4px gap:
    - Item title (Body/Regular-Medium, gray-900, 1 line)
    - Price (Body/Regular, orange): "$24"
    - "View Item" link (Body/Small, teal-700, underline)
  - Trade status badge (right-aligned): "Pending Pickup"

Message List (auto-layout vertical, reverse chronological, scrollable):

Message Bubble Component (reusable):
- Date separator (centered, gray-500, Body/Small): "Today" OR "Yesterday" OR "May 4, 2026"

Received Message (left-aligned):
- Avatar (32x32px, circle, left)
- Bubble (gray-100 bg, 12px radius, 16px padding, max 70% width):
  - Message text (Body/Regular, gray-900)
  - Timestamp (Body/Small, gray-500, right-aligned, 4px above bubble)
- Long-press menu: Copy, Report

Sent Message (right-aligned):
- Bubble (orange bg, 12px radius, 16px padding, max 70% width):
  - Message text (Body/Regular, white)
  - Timestamp (Body/Small, gray-500, left-aligned, 4px above bubble)
  - Delivery status icon (16px, white/80% opacity):
    - Single checkmark: Sent
    - Double checkmark: Delivered
    - Double checkmark (orange): Read
- Long-press menu: Copy, Delete

System Message (centered):
- Gray-50 bg, 8px radius, 12px padding, max 80% width
- Icon (20px, gray-600) + Text (Body/Small, gray-700):
  - "Trade completed. You can now review [Name]."
  - "Pickup scheduled for May 5 at 3:00 PM"
  - "[Name] confirmed delivery"
- Action button (if applicable): "Leave Review" (Button/Tertiary/Small)

Quick Reply Suggestions (if trade active, above input):
- Horizontal scroll, pill buttons, 8px gap:
  - "When can we meet?" (gray-200 bg, gray-900 text, 8px radius, 12px padding)
  - "Is this still available?" 
  - "Can you send more photos?"
  - "I'm interested!"

Safety Reminder Banner (random, occasional):
- Yellow-50 bg, yellow-600 border-left (4px), 12px padding
- Shield icon (20px, yellow-700) + Text (Body/Small, yellow-900):
  - "Safety tip: Always meet in public places like police station parking lots"
  - "Learn More" link (orange, underline)

Message Input (fixed to bottom):
- White bg, gray-200 border-top (1px), safe area insets, 12px padding
- Auto-layout horizontal, 8px gap:
  - Attachment button (40x40px, gray-200 bg, circle, paperclip icon, gray-600)
  - Text input (flex-grow, gray-100 bg, 12px radius, 12px padding):
    - Placeholder: "Type a message..."
    - Auto-expand up to 4 lines
  - Send button (40x40px, orange bg, circle, send icon, white):
    - Disabled (gray-300 bg) if input empty
    - Active (orange bg) if text present

Attachment Options (show when paperclip tapped):
- Modal/Action-Sheet
- Options:
  - "Take Photo" (camera icon)
  - "Choose from Library" (image icon)
  - "Share Location" (pin icon) - for pickup coordination
  - "Cancel"

Location Share Message:
- Map preview (200x150px, 8px radius, static map image)
- Address text (Body/Small, gray-700): "123 Main St, City, State"
- "Open in Maps" link (Body/Small, orange, underline)

---
FIELD INVENTORY — ConversationDetailScreen:

INPUT FIELDS (user-editable):
- Message text input: text input, auto-expands up to 4 lines, placeholder "Type a message..."
- Send button: submits message (disabled if input empty, enabled when text present)
- Attachment button (paperclip icon): opens Attachment Options action sheet
- Attachment options: Take Photo | Choose from Library | Share Location | Cancel
- Quick reply suggestions: pre-populated tap buttons ("When can we meet?", "Is this still available?", etc.)
- Long-press received message: Copy | Report
- Long-press sent message: Copy | Delete
- More menu (3-dots, header): Report User | Block User | Archive Conversation

DISPLAY FIELDS (read-only):
- Header: other party's avatar, display name, star rating + review count (dynamic from DB)
- Trade context banner: item thumbnail, title, price, "View Item" link, trade status badge (conditional, dynamic)
- Message bubbles: received (gray-100 bg) and sent (orange bg) with text, timestamps, delivery status icons (dynamic from DB)
- Date separators: "Today" / "Yesterday" / date string (dynamic)
- System messages: "Trade completed. You can now review [Name]." (conditional, dynamic)
- Quick reply suggestions (horizontal scroll, static options, shown when trade is active)
- Safety reminder banner (occasional, conditional): "Always meet in public places" (yellow)
- Location share message: static map preview + address + "Open in Maps" link (conditional)
- Delivery status icons: sent (✓), delivered (✓✓), read (orange ✓✓) (dynamic)

AUTO-CALCULATED:
- Messages ordered chronologically, newest at bottom
- Delivery status from message.status field
- System messages triggered automatically by trade state changes
---

SCREEN 3: MessageComposeScreen (Optional Modal)
Context: Compose new message to seller (from ItemDetailScreen)

Modal/Full-Overlay:
- "Message Seller" (Heading/H2, gray-900, centered)
- Close button (top-right, X icon)

Item Context (16px padding):
- Item thumbnail (80x80px, 8px radius, centered)
- Title (Body/Large-Medium, gray-900, centered)
- Price (Body/Regular, orange, centered)

Seller Info (16px padding):
- Avatar (48x48px, circle, centered)
- Name (Body/Regular-Medium, gray-900, centered)
- Rating (Body/Small, gray-600, centered): "⭐ 4.8"

Quick Message Templates (16px padding):
- "Choose a template or write your own" (Body/Small, gray-600)
- Template buttons (auto-layout vertical, 8px gap):
  - "Is this still available?" (Button/Secondary/Medium, full-width)
  - "Can we meet this weekend?" (Button/Secondary/Medium)
  - "Can you send more photos?" (Button/Secondary/Medium)
  - "I'm interested. When can I pick up?" (Button/Secondary/Medium)
- "Or write your own message" divider

Custom Message Input:
- Textarea (Form-Input/Default, 4 rows, placeholder: "Type your message...")

Actions:
- "Send Message" button (Button/Primary/Large, full-width)
- Disabled until template selected or custom text entered

---
FIELD INVENTORY — MessageComposeScreen (Modal):

INPUT FIELDS (user-editable):
- Template buttons (4 options): tap to pre-fill message ("Is this still available?", "Can we meet this weekend?", "Can you send more photos?", "I'm interested. When can I pick up?")
- Custom message textarea: free text, 4 rows, placeholder "Type your message..."
- "Send Message" button: creates new conversation + sends first message (disabled until template selected or text entered)

DISPLAY FIELDS (read-only):
- Item context: thumbnail, title, price (dynamic from navigation params)
- Seller info: avatar, display name, star rating (dynamic from DB)
- "Or write your own message" divider (static)

AUTO-CALCULATED:
- Creates new conversation record if first message between these two users for this item
- Navigates to ConversationDetailScreen after send
---

NAVIGATION FLOW:
- Bottom Tab → Messages → Conversation List → Select → Conversation Detail
- Item Detail → "Message Seller" button → Compose Modal → Send → Conversation Detail
- Trade Active → Messages notification → Conversation Detail
- Conversation → View Item → Item Detail

FIGMA-SPECIFIC REQUIREMENTS:

- AI Empowerment: Treat these requirements as a starting point. Please provide suggestions for UI/UX improvements, alternative screen layouts, or propose new screens if they create a more ideal user experience.
- AI Collaboration: Please ask clarification questions or push back on any requirements that do not make structural or UX sense.
- Dependencies: Call out any design or flow dependencies you encounter while reading the prompts.
- Recommendations: For any questions or pushback, please provide your specific recommendations for how to proceed.

- Prototype Configuration: Use "Smart Animate" for transitions (300ms ease-in-out)
- Prototype Configuration: Configure overflow scrolling for long content areas
- Prototype Configuration: Add bottom tab bar navigation to all applicable screens
- Prototype Configuration: Link all modal overlays to dismiss on background tap
- Prototype Configuration: Configure keyboard navigation for form flows
- Conversation card component (unread variant with bold text)
- Message bubble variants (sent/received/system)
- Swipe action prototype (delete/archive)
- Date separator component
- Quick reply pill buttons
- Message input with auto-expand prototype
- Attachment modal/action-sheet
- Location share map preview component
- Safety banner (yellow alert style)
- Delivery status icons (checkmarks)
- Interactive prototype: send message, scroll to bottom, swipe actions
- Create avatar + name component (reusable)
```

---

## FLOW-14: Referral Program

**Priority**: P2 (Medium) — Growth mechanism, SP earning opportunity

```
Design the referral program interface. Reference app-overview.md Section 4.1 (referral SP rewards), design-system.md, and screen-flow-mapping.md FLOW-14.

SCREENS TO DESIGN (2 total):
1. ReferralProgramScreen
2. ReferralSuccessScreen

Use design-system.md components, emphasize share-ability, reward tracking.

---

SCREEN 1: ReferralProgramScreen
Frame: 375x812px, white background

Header:
- Back button (top-left)
- "Refer & Earn" title (Heading/H2, gray-900, centered)

Hero Card (16px padding):
- Gradient card (orange-to-teal, 45deg), 16px radius, 24px padding, shadow
- Illustration (120x120px, centered): Friends/gift icon (white)
- "Invite Friends, Earn SP!" (Heading/H2, white, centered)
- Reward info (Body/Large, white/90% opacity, centered):
  - "You get 500 SP • Your friend gets 500 SP"
  - "When they complete their first trade"

How It Works Section (16px below hero):
- "How It Works" (Heading/H3, gray-900, 16px horizontal padding)
- Steps (auto-layout vertical, 16px gap, 16px horizontal padding):
  
  Step 1 Card:
  - White bg, teal-200 border-left (4px), 12px radius, 16px padding
  - Auto-layout horizontal, 12px gap:
    - Step number (32x32px circle, teal-600 bg, white text, Heading/H3): "1"
    - Content (auto-layout vertical, 4px gap):
      - "Share Your Code" (Body/Regular-Medium, gray-900)
      - "Send your unique referral code to friends" (Body/Small, gray-600)
  
  Step 2 Card:
  - White bg, orange-200 border-left (4px), 12px radius, 16px padding
  - Step number (orange bg): "2"
  - "They Sign Up" (Body/Regular-Medium, gray-900)
  - "Your friend creates an account using your code" (Body/Small, gray-600)
  
  Step 3 Card:
  - White bg, green-200 border-left (4px), 12px radius, 16px padding
  - Step number (green-600 bg): "3"
  - "You Both Earn!" (Body/Regular-Medium, gray-900)
  - "Get 500 SP each when they complete first trade" (Body/Small, gray-600)

Referral Code Section (16px below steps):
- "Your Referral Code" (Heading/H3, gray-900, 16px horizontal padding)
- Code card (16px horizontal padding):
  - White bg, gray-200 border (2px), 12px radius, 24px padding
  - Code (Heading/Display-1, orange, centered, monospace): "PASS2024"
  - "Copy Code" button (Button/Secondary/Large, full-width, 12px below code)
  - Copy icon (20px, orange) + "Copied!" success state (green checkmark)

Referral Link Section (16px below code):
- "Or Share Link" (Body/Regular-Medium, gray-900, 16px horizontal padding)
- Link preview (16px horizontal padding):
  - Gray-50 bg, 12px radius, 16px padding
  - Link text (Body/Small, gray-700, ellipsis): "passitup.app/ref/PASS2024"
  - "Copy Link" button (Button/Tertiary/Medium, 8px above)

Share Buttons (16px below link):
- "Share via" (Body/Regular-Medium, gray-900, 16px horizontal padding)
- Share options (auto-layout horizontal, 12px gap, 16px horizontal padding, scrollable):
  - Share button component (64x64px, vertical layout):
    - Icon circle (48x48px, brand color bg, white icon): 
      - Messages (green)
      - WhatsApp (green)
      - Instagram (purple gradient)
      - Facebook (blue)
      - Twitter/X (black)
      - More (gray)
    - Label (Body/Small, gray-700, centered): "Messages"

Referral Stats Section (16px below share):
- "Your Referrals" (Heading/H3, gray-900, 16px horizontal padding)
- Stats cards (auto-layout horizontal, 12px gap, 16px horizontal padding):
  
  Total Invited Card:
  - White bg, gray-200 border, 12px radius, 16px padding, flex-grow
  - Icon (32px, gray-600, users)
  - Number (Heading/H2, gray-900): "12"
  - Label (Body/Small, gray-600): "Total Invited"
  
  Completed Card:
  - White bg, green-200 border-left (4px), 12px radius, 16px padding, flex-grow
  - Icon (32px, green-600, checkmark)
  - Number (Heading/H2, green-600): "8"
  - Label (Body/Small, gray-600): "Completed"
  
  SP Earned Card:
  - White bg, orange-200 border-left (4px), 12px radius, 16px padding, flex-grow
  - Icon (32px, orange, star)
  - Number (Heading/H2, orange): "4,000"
  - Label (Body/Small, gray-600): "SP Earned"

Referral History List (16px below stats):
- "Recent Referrals" (Heading/H3, gray-900, 16px horizontal padding)
- List (auto-layout vertical, 8px gap, 16px horizontal padding):
  
  Referral Item Card:
  - White bg, gray-200 border, 12px radius, 16px padding
  - Auto-layout horizontal, space-between:
    - Left section:
      - Friend name (Body/Regular-Medium, gray-900): "Alex M."
      - Status (Body/Small):
        - Pending: "Signed up • Awaiting first trade" (gray-600)
        - Completed: "Completed first trade" (green-600)
      - Date (Body/Small, gray-500): "May 4, 2026"
    - Right section:
      - SP amount (Body/Large-Medium):
        - Pending: "+500 SP" (gray-500)
        - Completed: "+500 SP" (green-600)
      - Status badge:
        - Pending: "Pending" (yellow-100 bg, yellow-800 text, pill)
        - Completed: "Earned" (green-100 bg, green-800 text, pill)

Empty State (no referrals):
- Illustration (160x160px): Gift box (gray-400)
- "No referrals yet" (Heading/H3, gray-700, centered)
- "Share your code to start earning SP" (Body/Regular, gray-600, centered)

Terms Link (bottom, 16px padding):
- "View Referral Terms & Conditions" (Body/Small, orange, underline, centered)

---
FIELD INVENTORY — ReferralProgramScreen:

INPUT FIELDS (user-editable):
- "Copy Code" button: copies referral code to clipboard (shows "Copied!" success state briefly)
- "Copy Link" button: copies referral deep link to clipboard
- Share buttons (per platform): Messages | WhatsApp | Instagram | Facebook | Twitter/X | More — triggers native system share sheet
- "View Referral Terms & Conditions" link: opens referral terms

DISPLAY FIELDS (read-only):
- Hero card (gradient): "You get 500 SP • Your friend gets 500 SP When they complete their first trade" (dynamic reward amounts from admin config)
- How It Works: 3 numbered step cards (Share Code → They Sign Up → You Both Earn) (static)
- Referral code: "PASS2024" (monospace, dynamic from profiles.referral_code)
- Referral deep link: "passitup.app/ref/[code]" (dynamic)
- Share buttons row: platform icons (static list)
- Referral stats: total invited count, completed count, total SP earned (dynamic from DB)
- Referral history list: friend display name/avatar, signup status (Pending/Completed), date, SP amount awarded (dynamic from referrals table)
- "Copied!" transient success state on copy buttons (conditional)
- Empty history state: "No referrals yet" + CTA (conditional)

AUTO-CALCULATED:
- getReferralStats() RPC: totalInvited, completedCount, totalSpEarned
- getReferralHistory() RPC: list of referral records with status + timestamps
- Reward amounts from admin_config referral SP settings
---

SCREEN 2: ReferralSuccessScreen
Frame: 375x812px, white background

Success Animation (centered, 24px from top):
- Confetti animation OR green checkmark (80x80px)

Success Message (centered, 16px below animation):
- "You Earned 500 SP!" (Heading/Display-1, green-600)
- "Thanks for inviting [Friend Name]" (Body/Large, gray-700)

Reward Card (16px padding):
- Gradient card (orange-to-teal), 16px radius, 24px padding
- Star icon (64x64px, white)
- SP amount (Heading/Display-1, white, centered): "+500 SP"
- Cash equivalent (Body/Large, white/90% opacity, centered): "~$5.00 value"
- Reason (Body/Regular, white/80% opacity, centered):
  - "[Friend Name] completed their first trade!"

What's Next Section (16px below card):
- "Keep Inviting Friends!" (Heading/H3, gray-900, 16px horizontal padding)
- Benefits list (auto-layout vertical, 8px gap, 16px horizontal padding):
  - Card (teal-50 bg, 12px radius, 12px padding):
    - Checkmark (green) + "Unlimited referrals" (Body/Regular, gray-900)
  - Card:
    - Checkmark + "500 SP per successful referral" (Body/Regular, gray-900)
  - Card:
    - Checkmark + "Your friends get 500 SP too" (Body/Regular, gray-900)

Share Again Section (16px below benefits):
- "Share Your Code" (Heading/H3, gray-900, 16px horizontal padding)
- Code display (same as ReferralProgramScreen)
- Share buttons (same layout)

Actions (fixed to bottom):
- "Share Again" button (Button/Primary/Large, full-width)
- "View My Wallet" button (Button/Secondary/Large, full-width, 12px below)
- "Done" link (Body/Small, gray-600, centered, 12px below)

---
FIELD INVENTORY — ReferralSuccessScreen:

INPUT FIELDS (user-editable):
- "Share Again" button: re-opens native share sheet with referral code/link
- "View My Wallet" button: navigates to SpWalletScreen
- "Done" link: dismisses screen, returns to previous screen (ProfileScreen or Home)

DISPLAY FIELDS (read-only):
- Confetti animation / success icon (green checkmark, 80×80px) (static)
- "You Earned 500 SP!" heading (dynamic — SP reward amount from admin config)
- "Thanks for inviting [Friend Name]" subtitle (dynamic — friend's display_name from referral record)
- Reward card (gradient orange-to-teal): SP amount "+500 SP", cash equivalent "~$5.00", trigger reason "[Friend Name] completed their first trade!" (dynamic)
- What's Next benefits list: unlimited referrals, 500 SP per referral, friend also earns 500 SP (static)
- Referral code card + share buttons row (dynamic code, static platform list)

AUTO-CALCULATED:
- SP reward amount from admin_config referral SP settings
- Friend display name from profiles.display_name via referral record
---

NAVIGATION FLOW:
- Profile → Referrals → ReferralProgramScreen → Share code/link
- Notification: "Friend joined!" → ReferralProgramScreen → Updated stats
- Push notification: "Referral completed!" → ReferralSuccessScreen → View SP
- ReferralSuccess → View Wallet → SpWalletScreen (updated balance)

FIGMA-SPECIFIC REQUIREMENTS:

- AI Empowerment: Treat these requirements as a starting point. Please provide suggestions for UI/UX improvements, alternative screen layouts, or propose new screens if they create a more ideal user experience.
- AI Collaboration: Please ask clarification questions or push back on any requirements that do not make structural or UX sense.
- Dependencies: Call out any design or flow dependencies you encounter while reading the prompts.
- Recommendations: For any questions or pushback, please provide your specific recommendations for how to proceed.

- Prototype Configuration: Use "Smart Animate" for transitions (300ms ease-in-out)
- Prototype Configuration: Configure overflow scrolling for long content areas
- Prototype Configuration: Add bottom tab bar navigation to all applicable screens
- Prototype Configuration: Link all modal overlays to dismiss on background tap
- Prototype Configuration: Configure keyboard navigation for form flows
- Gradient hero card (orange-to-teal)
- Step cards with colored left border + numbered circles
- Referral code component (large, centered, monospace font)
- Copy button with success state (icon swap: copy → checkmark)
- Share button grid (brand-colored circles with icons)
- Stats cards (3-column layout, responsive)
- Referral history list (pending/completed variants)
- Success animation or confetti frame
- Interactive prototype: copy code, share buttons, view stats
- Create share icon components (Messages, WhatsApp, Instagram, Facebook, Twitter, More)
- Status badge variants (Pending/Earned)
```

---

## 75% CHECKPOINT COMPLETE! 🎯

You've now completed **14 of 18 flows** (approximately 75%):

✅ **Completed Prompts**:
- FLOW-01: Authentication (7 screens)
- FLOW-02: Profiles & Onboarding (5 screens)
- FLOW-03: Node/ZIP Gating (2 screens)
- FLOW-06: Discovery (3 screens)
- FLOW-04: Listing Management (5 screens)
- FLOW-05: Media Upload (integrated)
- FLOW-07: Cart & Bundling (2 screens - NEW)
- FLOW-08: Trade Flow (6 screens)
- FLOW-09: Fees & Pricing (integrated)
- FLOW-10: SP Wallet (3 screens)
- FLOW-11: SP Earn/Spend Logic (4 components)
- FLOW-12: Subscription Management (4 screens)
- FLOW-13: Messaging (3 screens)
- FLOW-14: Referral Program (2 screens)

⏳ **Remaining Flows** (25%):
- FLOW-15: Notifications
- FLOW-16: Support & Help
- FLOW-17: Subscription Events
- FLOW-18: CPSC Recalls & Admin Actions

**What's Been Designed**:
- Complete authentication and onboarding flows
- Full listing creation including bulk upload and safety reviews
- NEW cart and multi-item checkout with SP allocation
- Complete trade lifecycle with state machine
- SP wallet with transaction history and balance breakdown
- SP earning/spending calculations and tier comparisons
- Subscription management with upgrade/cancellation flows
- Messaging interface for buyer-seller coordination
- Referral program with share functionality

---

## FLOW-15: Notifications & Alerts

**Priority**: P1 (High) — User engagement, trade updates, SP earnings

```
Design the notifications interface. Reference app-overview.md (trade flow, SP mechanics), design-system.md, and screen-flow-mapping.md FLOW-15.

SCREENS TO DESIGN (2 total):
1. NotificationsListScreen
2. NotificationSettingsScreen

Use design-system.md components, emphasize actionable notifications, clear categorization.

---

SCREEN 1: NotificationsListScreen
Frame: 375x812px, white background

Header:
- "Notifications" title (Heading/H2, gray-900, left-aligned, 16px from left)
- Unread count badge (top-right, orange circle bg, white text): "5"
- Settings icon (top-right, 44x44px, gear icon, gray-600, left of badge)

Filter Tabs (horizontal, below header, 16px horizontal padding):
- "All" (default), "Trades", "Messages", "SP", "System"
- Active tab: orange text + 2px bottom border (orange)
- Inactive: gray-600 text
- Count badge per tab: "(3)" (gray-500)

Mark All Read Button (right-aligned, below tabs):
- "Mark all as read" (Body/Small, orange, underline)

Notification List (auto-layout vertical, scrollable, grouped by date):

Date Separator (sticky header):
- Gray-100 bg, 12px padding
- Date text (Body/Small-Medium, gray-700): "Today" OR "Yesterday" OR "May 4, 2026"

Notification Card Component (reusable):
- Frame: full-width, auto-height
- White bg (unread) OR gray-50 bg (read)
- 16px padding, separator line (1px gray-200) between cards
- Swipe-able (mark read/delete on swipe)
- Auto-layout horizontal, 12px gap:
  - Icon section (40x40px, colored circle bg):
    - Trade: Orange bg, shopping bag icon (white)
    - Message: Teal bg, chat bubble icon (white)
    - SP: Orange bg, star icon (white)
    - System: Gray-600 bg, bell icon (white)
    - Referral: Green bg, gift icon (white)
  - Content section (flex-grow, auto-layout vertical, 4px gap):
    - Title (Body/Regular-Medium, gray-900 OR gray-700 if read):
      - "Trade Update: Pickup Confirmed"
      - "New Message from [Name]"
      - "You Earned 250 SP!"
      - "Subscription Expiring Soon"
      - "Friend Joined: Earn 500 SP"
    - Description (Body/Regular, gray-700 OR gray-600 if read, 2 lines max):
      - Brief summary of notification content
    - Timestamp (Body/Small, gray-500): "5m ago" OR "2h ago" OR "May 4"
    - Action button (if applicable, Button/Tertiary/Small):
      - "View Trade" OR "Reply" OR "View Wallet" OR "Renew Now"
  - Unread indicator (right edge):
    - Blue dot (8px circle) if unread

Notification Type Variants:

1. Trade Update (orange icon):
- "Trade Update: [Status]"
- Description: "Buyer confirmed pickup for Boys Winter Jacket"
- CTA: "View Trade" button

2. Message (teal icon):
- "New Message from [Seller/Buyer Name]"
- Description: Message preview (1 line)
- CTA: "Reply" button

3. SP Earned (orange icon):
- "You Earned [X] SP!"
- Description: "From sale of [Item Name]"
- CTA: "View Wallet" button

4. SP Pending (yellow icon):
- "SP Release Pending"
- Description: "[X] SP will be released in 24-72 hours"
- CTA: "View Details" button

5. Subscription (purple icon):
- "Subscription [Status]"
- Description: "Your [Plan] subscription expires in [X] days"
- CTA: "Renew Now" button

6. Referral (green icon):
- "Referral Success!"
- Description: "[Friend Name] completed their first trade. You earned 500 SP!"
- CTA: "View Referrals" button

7. Recall Alert (red icon):
- "Safety Alert: Item Recalled"
- Description: "Your listing [Item Name] has been flagged by CPSC"
- CTA: "View Details" button

8. System (gray icon):
- "System Update"
- Description: "New features available in Pass It Up"
- CTA: "Learn More" button

Swipe Actions:
- Swipe left: Blue "Mark as Read" button (80px width, blue-600 bg, white checkmark icon)
- Swipe right: Red "Delete" button (60px width, red-600 bg, white trash icon)

Empty State (no notifications):
- Illustration (200x200px): Bell icon (gray-400)
- "No notifications yet" (Heading/H3, gray-700, centered)
- "You'll see updates about trades, messages, and SP here" (Body/Regular, gray-600, centered)

Bottom Tab Bar (same as DiscoverScreen)

---
FIELD INVENTORY — NotificationsListScreen:

INPUT FIELDS (user-editable):
- Filter tabs: single-select (All | Trades | Messages | SP | System)
- "Mark all as read" link: marks all visible notifications as read
- Notification card tap: navigates to related screen (TradeDetailScreen, ConversationDetailScreen, SpWalletScreen, etc. — based on type)
- Swipe left (per card): "Mark as Read" action (blue button)
- Swipe right (per card): "Delete" action (red button)
- Settings icon (header): navigates to NotificationSettingsScreen
- Per-card action button CTA: "View Trade" / "Reply" / "View Wallet" / "Renew Now" / "View Referrals" / "View Details" (varies by notification type)
- Pull-to-refresh: RefreshControl gesture

DISPLAY FIELDS (read-only):
- Date separator sticky headers: "Today" / "Yesterday" / date string (dynamic, grouped by day)
- Notification cards: type icon (colored circle), title, description (2 lines), timestamp, unread dot (dynamic from DB)
- Read/unread visual: white bg = unread, gray-50 bg = read; bold title = unread (dynamic)
- Tab count badges: "(3)" per tab (dynamic)
- Unread count badge in header (orange circle with white number) (dynamic)
- Empty state: bell illustration + "No notifications yet" + description (conditional)

AUTO-CALCULATED:
- getNotifications() paginated, filtered by selected tab type
- Unread count: notifications WHERE read_at IS NULL
---

SCREEN 2: NotificationSettingsScreen
Frame: 375x812px, white background

Header:
- Back button (top-left)
- "Notification Settings" title (Heading/H2, gray-900, centered)

Master Toggle (16px padding):
- Card (white bg, gray-200 border, 12px radius, 16px padding):
  - Auto-layout horizontal, space-between:
    - "All Notifications" (Heading/H3, gray-900)
    - Toggle switch (large, orange when on, gray-300 when off)
  - Description (Body/Small, gray-600, 4px below):
    - "Master control for all notification types"

Notification Categories (16px below master, auto-layout vertical, 12px gap):

Section Header Component:
- "Category Name" (Heading/H3, gray-900, 16px horizontal padding)

Setting Card Component (reusable):
- White bg, gray-200 border, 12px radius, 16px padding
- Auto-layout vertical, 12px gap:
  - Header row (auto-layout horizontal, space-between):
    - Icon (24px, category color) + Label (Body/Regular-Medium, gray-900)
    - Toggle switch (orange when on)
  - Description (Body/Small, gray-600)
  - Sub-settings (if category enabled):
    - Push notifications checkbox
    - Email checkbox
    - In-app checkbox

Categories:

1. Trade Updates (orange icon):
- "Trade & Transaction Updates" (Body/Regular-Medium, gray-900)
- Description: "Get notified about trade status changes, pickups, and completions"
- Sub-settings:
  - ☑ Push notifications
  - ☑ Email
  - ☑ In-app

2. Messages (teal icon):
- "Messages & Conversations"
- Description: "New messages from buyers and sellers"
- Sub-settings (same as above)

3. SP & Wallet (orange icon):
- "Swap Points & Wallet"
- Description: "SP earned, spent, pending releases, and expiration alerts"
- Sub-settings (same)

4. Subscriptions (purple icon):
- "Subscription & Billing"
- Description: "Subscription renewals, payment issues, and trial expiration"
- Sub-settings (same)

5. Referrals (green icon):
- "Referral Program"
- Description: "When friends sign up and complete their first trade"
- Sub-settings (same)

6. Listings (blue icon):
- "Listing Updates"
- Description: "Item sold, expired, or flagged for safety review"
- Sub-settings (same)

7. Safety Alerts (red icon):
- "Safety & Recalls"
- Description: "CPSC recalls and safety warnings (always enabled)"
- Toggle: Disabled (grayed out, always on)
- Note (Body/Small, red-600): "Required for user safety"

8. Marketing (yellow icon):
- "Marketing & Promotions"
- Description: "New features, tips, and special offers"
- Sub-settings (same)

Quiet Hours Section (16px below categories):
- Card (white bg, gray-200 border, 12px radius, 16px padding):
  - "Quiet Hours" (Heading/H3, gray-900)
  - Description (Body/Small, gray-600): "Pause notifications during specific hours"
  - Toggle switch (right-aligned)
  - Time range inputs (if enabled):
    - "From:" time picker (9:00 PM)
    - "To:" time picker (7:00 AM)
  - Note (Body/Small, gray-600): "Trade updates and safety alerts will still come through"

Save Button (fixed to bottom):
- "Save Settings" button (Button/Primary/Large, full-width)

---
FIELD INVENTORY — NotificationSettingsScreen:

INPUT FIELDS (user-editable):
- "All Notifications" master toggle: enables/disables all notification types globally
- Per-category toggles (8 categories): Trade Updates | Messages | SP & Wallet | Subscriptions | Referrals | Listings | Safety Alerts (always-on, non-editable) | Marketing
- Per-category sub-settings checkboxes (when category enabled): Push notifications / Email / In-app
- Quiet Hours toggle: enables do-not-disturb time window
- Quiet Hours "From" time picker: start time (default 9:00 PM, visible only when Quiet Hours is on)
- Quiet Hours "To" time picker: end time (default 7:00 AM, visible only when Quiet Hours is on)
- "Save Settings" button: persists all preferences to DB

DISPLAY FIELDS (read-only):
- Master toggle state: on/off (dynamic from DB preferences)
- Per-category toggle states: on/off per category (dynamic)
- Safety Alerts row: toggle grayed out + non-interactive + "Required for user safety" note (static, always enabled, cannot be disabled)
- Quiet Hours time range: visible only when Quiet Hours is enabled (dynamic)
- "Trade updates and safety alerts will still come through" quiet hours disclaimer note (static)

AUTO-CALCULATED:
- All preference states loaded from notification_preferences table
- updateNotificationPreferences() RPC on Save
---

NAVIGATION FLOW:
- Bottom Tab → Notifications badge → Notifications List
- Notification → Tap → Navigate to related screen (Trade Detail, Messages, Wallet, etc.)
- Notifications → Settings icon → Notification Settings → Toggle preferences → Save
- Push notification received → Tap → Notifications List → Specific notification → Action

FIGMA-SPECIFIC REQUIREMENTS:

- AI Empowerment: Treat these requirements as a starting point. Please provide suggestions for UI/UX improvements, alternative screen layouts, or propose new screens if they create a more ideal user experience.
- AI Collaboration: Please ask clarification questions or push back on any requirements that do not make structural or UX sense.
- Dependencies: Call out any design or flow dependencies you encounter while reading the prompts.
- Recommendations: For any questions or pushback, please provide your specific recommendations for how to proceed.

- Prototype Configuration: Use "Smart Animate" for transitions (300ms ease-in-out)
- Prototype Configuration: Configure overflow scrolling for long content areas
- Prototype Configuration: Add bottom tab bar navigation to all applicable screens
- Prototype Configuration: Link all modal overlays to dismiss on background tap
- Prototype Configuration: Configure keyboard navigation for form flows
- Notification card component with type variants (trade/message/SP/system/referral/recall)
- Icon circle component with color variants (orange/teal/purple/green/red/gray)
- Swipe action prototype (mark read/delete)
- Toggle switch component (on/off states, orange active color)
- Date separator component (sticky header effect)
- Unread indicator (blue dot, visible/hidden variants)
- Interactive prototype: tap notification → navigate to detail, swipe actions
- Create setting card component with sub-checkboxes
- Time picker component for quiet hours
- Empty state illustration
```

---

## FLOW-16: Support & Help Center

**Priority**: P2 (Medium) — User assistance, issue resolution

```
Design the support and help center interface. Reference app-overview.md (app features), design-system.md, and screen-flow-mapping.md FLOW-16.

SCREENS TO DESIGN (4 total):
1. HelpCenterScreen
2. FAQDetailScreen
3. ContactSupportScreen
4. TicketDetailScreen

Use design-system.md components, emphasize self-service, clear categorization.

---

SCREEN 1: HelpCenterScreen
Frame: 375x812px, white background

Header:
- Back button (top-left)
- "Help Center" title (Heading/H2, gray-900, centered)

Search Bar (16px padding):
- Pill shape, white bg, gray-300 border (1px), 52px height
- Search icon (left, 20px, gray-500)
- Input placeholder: "Search for help..."
- Trending searches below (Body/Small, gray-600):
  - "How to earn SP" • "Pickup safety" • "Refunds" (tappable chips)

Quick Actions Cards (16px below search, auto-layout vertical, 12px gap):

1. Active Tickets Card (if user has open tickets):
- Orange-50 bg, orange-600 border-left (4px), 12px radius, 16px padding
- Auto-layout horizontal, space-between:
  - Icon (32px, orange, ticket) + "Your Support Tickets" (Body/Regular-Medium, gray-900)
  - Badge: "2 Open" (orange bg, white text, pill)
- "View Tickets →" link (Body/Small, orange, underline)

2. Contact Support Card:
- Teal-50 bg, teal-600 border-left (4px), 12px radius, 16px padding
- Icon (32px, teal, chat) + "Contact Support" (Body/Regular-Medium, gray-900)
- Description (Body/Small, gray-700): "Get help from our team"
- "Start Chat" button (Button/Secondary/Small)

Help Categories Section (16px below quick actions):
- "Browse Topics" (Heading/H3, gray-900, 16px horizontal padding)

Category Cards (auto-layout vertical, 12px gap, 16px horizontal padding):

Category Card Component (reusable):
- White bg, gray-200 border (1px), 12px radius, 16px padding
- Auto-layout horizontal, 12px gap, tappable:
  - Icon (40x40px, colored circle bg, white icon):
    - Getting Started: Teal bg, rocket icon
    - Buying: Orange bg, shopping cart icon
    - Selling: Orange bg, tag icon
    - SP Wallet: Orange bg, star icon
    - Subscriptions: Purple bg, crown icon
    - Safety: Red bg, shield icon
    - Account: Gray-600 bg, user icon
  - Content (flex-grow, auto-layout vertical, 4px gap):
    - Title (Body/Regular-Medium, gray-900): "Getting Started"
    - Article count (Body/Small, gray-600): "12 articles"
  - Chevron-right icon (16px, gray-400)

Popular Articles Section (16px below categories):
- "Popular Articles" (Heading/H3, gray-900, 16px horizontal padding)
- Article list (auto-layout vertical, 8px gap):

Article Card Component (reusable):
- White bg, gray-200 border (1px), 12px radius, 16px padding
- Auto-layout horizontal, space-between, tappable:
  - Left section:
    - Title (Body/Regular, gray-900, 2 lines max): "How to earn Swap Points on sales"
    - Views (Body/Small, gray-500): "👁 1.2k views"
  - Chevron-right icon (16px, gray-400)

Community Resources Section (16px below articles):
- Card (gray-50 bg, 12px radius, 16px padding):
  - "Community Resources" (Heading/H3, gray-900)
  - Resources (auto-layout vertical, 8px gap):
    - Link: "📖 Trading Guidelines" (Body/Regular, teal-700, underline)
    - Link: "🛡 Safety Best Practices" (Body/Regular, teal-700, underline)
    - Link: "❓ Community Forum" (Body/Regular, teal-700, underline)

Contact Info Section (bottom, 16px padding):
- Card (white bg, gray-200 border, 12px radius, 16px padding):
  - "Need More Help?" (Body/Regular-Medium, gray-900)
  - "Our support team is here 7 days a week" (Body/Small, gray-600)
  - "support@passitup.app" (Body/Regular, teal-700, underline)
  - Response time (Body/Small, gray-500): "⏱ Avg. response: 2-4 hours"

---
FIELD INVENTORY — HelpCenterScreen:

INPUT FIELDS (user-editable):
- Search bar: text input, placeholder "Search for help...", filters articles and categories by keyword
- Trending search chips: pre-populated tappable chips ("How to earn SP", "Pickup safety", "Refunds")
- Category cards: tappable, navigates to article list within that category
- Popular article cards: tappable, navigates to FAQDetailScreen
- Community resource links (Trading Guidelines, Safety Best Practices, Community Forum): external links
- "Start Chat" button (Contact Support card): navigates to ContactSupportScreen
- "View Tickets →" link (Active Tickets card, conditional): navigates to ticket list
- "support@passitup.app" link: opens email client

DISPLAY FIELDS (read-only):
- Active Tickets card (conditional, orange-50 bg): shows open ticket count badge, only if user has open tickets (dynamic)
- Contact Support card (teal-50 bg): static
- Category cards: icon, title, article count per category (dynamic from DB)
- Popular article cards: title, view count (dynamic from DB)
- Community resources list (static links)
- Contact info: email + "Avg. response: 2-4 hours" (static)

AUTO-CALCULATED:
- getHelpCategories() for category list + article counts
- getPopularArticles() for most-viewed articles
- getOpenTickets() for Active Tickets card conditional visibility
---

SCREEN 2: FAQDetailScreen
Frame: 375x812px, white background

Header:
- Back button (top-left)
- Share icon (top-right, 44x44px, share icon, gray-600)

Breadcrumb (16px padding):
- "Help Center > Getting Started" (Body/Small, gray-600, chevron separators)

Article Header (16px padding):
- Title (Heading/H2, gray-900): "How to earn Swap Points on sales"
- Metadata (auto-layout horizontal, 8px gap, Body/Small, gray-500):
  - "👁 1.2k views"
  - "•"
  - "Updated May 4, 2026"

Article Content (16px padding, scrollable):
- Rich text content (Body/Regular, gray-900, line-height 1.6):
  - Headings (Heading/H3, gray-900)
  - Body paragraphs (Body/Regular, gray-700)
  - Bullet lists (gray-700, 8px vertical spacing)
  - Numbered lists (same)
  - Code blocks (gray-100 bg, Fira Code font, 12px radius, 12px padding)
  - Images (full-width, 12px radius, 16px vertical margin)
  - Callout boxes:
    - Info: Blue-50 bg, blue-600 border-left (4px)
    - Warning: Yellow-50 bg, yellow-600 border-left (4px)
    - Tip: Green-50 bg, green-600 border-left (4px)

Was This Helpful Section (16px below content):
- Card (gray-50 bg, 12px radius, 16px padding, centered):
  - "Was this article helpful?" (Body/Regular-Medium, gray-900)
  - Thumbs buttons (auto-layout horizontal, 12px gap, centered):
    - Thumbs up button (48x48px, gray-200 bg OR green-100 bg if selected, green-600 icon)
    - Thumbs down button (48x48px, gray-200 bg OR red-100 bg if selected, red-600 icon)
  - Feedback text (if selected, Body/Small, gray-600): "Thanks for your feedback!"

Related Articles Section (16px below helpful):
- "Related Articles" (Heading/H3, gray-900, 16px horizontal padding)
- Article cards (same as HelpCenterScreen, 3-4 articles)

Still Need Help Card (16px below related):
- Teal-50 bg, 12px radius, 16px padding, centered:
  - "Still need help?" (Body/Regular-Medium, gray-900)
  - "Contact our support team" (Body/Regular, gray-700)
  - "Contact Support" button (Button/Primary/Medium)

---
FIELD INVENTORY — FAQDetailScreen:

INPUT FIELDS (user-editable):
- Share icon (header, top-right): shares article URL via native share sheet
- "Thumbs up" button: positive helpfulness vote (toggles green selected state)
- "Thumbs down" button: negative helpfulness vote (toggles red selected state)
- Related article cards: tappable, navigates to another FAQDetailScreen
- "Contact Support" button (Still Need Help card): navigates to ContactSupportScreen
- Breadcrumb links: "Help Center" / category name — tappable to navigate back
- Internal article links (within content): tap to navigate to linked article or external resource

DISPLAY FIELDS (read-only):
- Breadcrumb trail: "Help Center > [Category]" (dynamic)
- Article title (dynamic from DB)
- View count + last updated date (dynamic)
- Article rich-text content: headings, paragraphs, bullet lists, numbered lists, code blocks, callout boxes (info/warning/tip), images (dynamic, markdown-rendered from DB)
- Thumbs feedback success text: "Thanks for your feedback!" (conditional, shown after voting)
- Related articles list: 3–4 article cards (dynamic)
- Still Need Help card: "Contact Support" CTA (static)

AUTO-CALCULATED:
- getArticleById(articleId) + getRelatedArticles() RPC
- Article helpful/not-helpful counts updated on thumb tap
---

SCREEN 3: ContactSupportScreen
Frame: 375x812px, white background

Header:
- Back button (top-left)
- "Contact Support" title (Heading/H2, gray-900, centered)

Priority Banner (if Pro member):
- Purple-50 bg, purple-600 border-left (4px), 12px padding, 16px padding
- Crown icon (20px, purple-700) + "Priority Support" (Body/Regular-Medium, purple-900)
- "Avg. response time: 1-2 hours" (Body/Small, gray-600)

Issue Category Selection (16px padding):
- "What do you need help with?" (Heading/H3, gray-900)
- Category buttons (auto-layout vertical, 8px gap):

Category Button Component:
- White bg, gray-200 border (1px), 12px radius, 16px padding
- Radio button (left, 20px, orange when selected)
- Auto-layout horizontal, 12px gap, tappable:
  - Icon (24px, category color)
  - Label (Body/Regular, gray-900): "Problem with a trade"
- Selected state: Orange border (2px)

Categories:
- 🛍 Problem with a trade
- 💳 Payment or refund issue
- ⭐ Swap Points question
- 👤 Account or login issue
- 🔔 Subscription or billing
- 🚨 Safety concern
- 📱 Technical issue
- 💬 Other

Related Trade Selection (if "Problem with a trade" selected):
- "Which trade?" (Body/Regular-Medium, gray-900, 12px below category)
- Dropdown (Form-Input/Default):
  - Shows recent trades: "[Item Name] - [Trade ID]"
  - "Select a trade..." placeholder

Issue Description (16px below category):
- "Describe the issue" (Heading/H3, gray-900)
- Textarea (Form-Input/Default, 6 rows):
  - Placeholder: "Please provide details about your issue..."
  - Character counter (Body/Small, gray-500): "0/1000"

Attachment Section (16px below description):
- "Add Screenshots (Optional)" (Body/Regular-Medium, gray-900)
- Upload zone (gray-100 bg, dashed border, 12px radius, 80px height):
  - Upload icon (32px, gray-500) + "Tap to upload" (Body/Regular, gray-600)
- Uploaded files preview (if any):
  - Thumbnail grid (3 columns, 8px gap)
  - Remove button per file (X icon overlay)

Contact Email Confirmation (16px below attachments):
- "We'll reply to:" (Body/Regular-Medium, gray-900)
- Email display (Body/Regular, gray-700): user's email
- "Update email" link (Body/Small, orange, underline)

Submit Button (fixed to bottom):
- "Submit Request" button (Button/Primary/Large, full-width)
- Disabled until category selected and description provided (min 20 chars)

---
FIELD INVENTORY — ContactSupportScreen:

INPUT FIELDS (user-editable):
- Issue category radio buttons: single-select (Problem with a trade | Payment or refund issue | SP question | Account/login issue | Subscription/billing | Safety concern | Technical issue | Other)
- Related trade dropdown (conditional, visible only if "Problem with a trade" selected): selects from user's recent trades
- Issue description textarea: required, min 20 / max 1000 chars, placeholder "Please provide details about your issue..."
- Screenshot upload: optional, up to 5 images (photo grid, camera or gallery)
- "Update email" link: navigates to profile email settings
- "Submit Request" button: creates support ticket (disabled until category selected + description ≥20 chars)

DISPLAY FIELDS (read-only):
- Priority banner (conditional, purple-50 bg): "Priority Support — Avg. response: 1-2 hours" (shown only if user subscription tier = Pro)
- Contact email confirmation: user's current email address (dynamic from auth session)
- Attachment file preview thumbnails (dynamic, shown after upload)
- Description character count: "0/1000" (dynamic, updates live)

AUTO-CALCULATED:
- Recent trades dropdown list from getActiveTradesForUser() RPC
- createSupportTicket() on Submit
- Priority flag set on ticket if subscription.tier = 'pro'
---

SCREEN 4: TicketDetailScreen
Frame: 375x812px, white background

Header:
- Back button (top-left)
- "Support Ticket" title (Heading/H2, gray-900, centered)
- More menu (top-right, 3-dots icon): Close ticket, Download conversation

Ticket Status Card (16px padding):
- Status badge (large, centered):
  - "Open" (yellow-100 bg, yellow-800 text)
  - "In Progress" (blue-100 bg, blue-800 text)
  - "Resolved" (green-100 bg, green-800 text)
  - "Closed" (gray-200 bg, gray-700 text)
- Ticket ID (Body/Small, gray-500, monospace): "#SUP-12345"
- Created date (Body/Small, gray-600): "May 4, 2026 at 2:30 PM"

Ticket Summary Card (16px padding):
- White bg, gray-200 border, 12px radius, 16px padding
- Category icon (24px) + Category (Body/Regular-Medium, gray-900): "Problem with a trade"
- Related trade (if applicable, Body/Small, gray-700): "Trade #TXN-A1B2C3D4"
- "View Trade →" link (Body/Small, orange, underline)

Conversation Thread (auto-layout vertical, 16px gap, scrollable):

Message Bubble Component:

Customer Message (right-aligned):
- Bubble (teal-50 bg, 12px radius, 16px padding, max 80% width):
  - Message text (Body/Regular, gray-900)
  - Attachments (if any): Image thumbnails (120x120px, 8px radius)
- Timestamp (Body/Small, gray-500, left-aligned, 4px above bubble)
- Avatar (32x32px, circle, right): User's avatar

Support Message (left-aligned):
- Avatar (32x32px, circle, left): Support agent avatar
- Agent name (Body/Small-Medium, gray-700): "Sarah from Support"
- Bubble (gray-100 bg, 12px radius, 16px padding, max 80% width):
  - Message text (Body/Regular, gray-900)
  - Helpful links (if any): Blue underlined links
- Timestamp (Body/Small, gray-500, right-aligned)

System Message (centered):
- Gray-50 bg, 8px radius, 12px padding, max 80% width
- Icon (20px, gray-600) + Text (Body/Small, gray-700):
  - "Ticket opened"
  - "Agent assigned: Sarah"
  - "Ticket resolved"

Reply Input (fixed to bottom, if ticket open):
- White bg, gray-200 border-top (1px), safe area insets, 12px padding
- Auto-layout horizontal, 8px gap:
  - Attachment button (40x40px, gray-200 bg, circle, paperclip icon)
  - Text input (flex-grow, gray-100 bg, 12px radius, 12px padding):
    - Placeholder: "Type your message..."
    - Auto-expand up to 4 lines
  - Send button (40x40px, teal bg, circle, send icon, white)

Ticket Resolved State (if resolved):
- Card (green-50 bg, 12px radius, 16px padding, centered):
  - Checkmark (48px, green-600)
  - "This ticket has been resolved" (Body/Regular-Medium, gray-900)
  - "Was this helpful?" rating (thumbs up/down)
  - "Reopen Ticket" button (Button/Tertiary/Medium)

---
FIELD INVENTORY — TicketDetailScreen:

INPUT FIELDS (user-editable):
- Reply text input (fixed bottom, only when ticket is open): free text, auto-expands up to 4 lines
- Attachment button (paperclip icon): opens photo upload for adding evidence to reply
- Send button: submits reply message (disabled if input empty)
- More menu (3-dots, header): Close Ticket | Download Conversation
- "Was this helpful?" thumbs (resolved state): positive/negative feedback on resolution quality
- "Reopen Ticket" button (resolved state): re-opens a resolved ticket
- "View Trade →" link (ticket summary card): navigates to TradeDetailScreen

DISPLAY FIELDS (read-only):
- Ticket status badge: Open (yellow) | In Progress (blue) | Resolved (green) | Closed (gray) (dynamic)
- Ticket ID (monospace, Fira Code): "#SUP-12345" (dynamic)
- Created date (dynamic)
- Ticket summary card: category icon + type label + related trade ID (dynamic)
- Conversation thread: customer bubbles (teal-50 bg), support agent bubbles (gray-100 bg), system messages (centered gray chips) (dynamic from DB)
- Agent name per support message (dynamic)
- Resolved state card (conditional, green-50 bg): "This ticket has been resolved" + thumbs feedback (shown when ticket.status = resolved)
- Reply input area hidden when ticket is Resolved or Closed

AUTO-CALCULATED:
- getTicketById(ticketId) for ticket data and message thread
- Messages ordered chronologically, newest at bottom
- Input disabled when ticket.status IN ('resolved', 'closed')
---

NAVIGATION FLOW:
- Profile → Help → Help Center → Browse categories/articles
- Help Center → Contact Support → Select issue → Submit → Ticket Detail
- Help Center → Search → Results → FAQ Detail
- Notifications → Support ticket update → Ticket Detail → Reply
- Ticket Detail → Related Trade → Trade Detail Screen

FIGMA-SPECIFIC REQUIREMENTS:

- AI Empowerment: Treat these requirements as a starting point. Please provide suggestions for UI/UX improvements, alternative screen layouts, or propose new screens if they create a more ideal user experience.
- AI Collaboration: Please ask clarification questions or push back on any requirements that do not make structural or UX sense.
- Dependencies: Call out any design or flow dependencies you encounter while reading the prompts.
- Recommendations: For any questions or pushback, please provide your specific recommendations for how to proceed.

- Prototype Configuration: Use "Smart Animate" for transitions (300ms ease-in-out)
- Prototype Configuration: Configure overflow scrolling for long content areas
- Prototype Configuration: Add bottom tab bar navigation to all applicable screens
- Prototype Configuration: Link all modal overlays to dismiss on background tap
- Prototype Configuration: Configure keyboard navigation for form flows
- Category card component with icon variants (8 types)
- Article card component (reusable)
- FAQ content with rich text formatting (headings, lists, callouts, code blocks)
- Thumbs up/down feedback component (selected/unselected states)
- Ticket status badge variants (Open/In Progress/Resolved/Closed)
- Message bubble variants (customer/support/system)
- Upload zone component with file preview
- Interactive prototype: search help, browse categories, submit ticket, chat with support
- Create category icon components (colored circles with white icons)
- Conversation thread with scrolling and auto-scroll to bottom on new message
```

---

## FLOW-17: Subscription Events & Lifecycle

**Priority**: P2 (Medium) — Subscription state management, revenue retention

```
Design subscription lifecycle event screens. Reference app-overview.md Section 4.1 (subscription tiers, trial period, earning cessation), design-system.md, and screen-flow-mapping.md FLOW-17.

SCREENS TO DESIGN (4 total):
1. TrialEndingScreen
2. SubscriptionExpiredScreen
3. PaymentFailedScreen
4. SubscriptionPausedScreen

Use design-system.md components, emphasize urgency, retention offers.

---

SCREEN 1: TrialEndingScreen
Frame: 375x812px, white background

Alert Icon (centered, 24px from top):
- Yellow circle (80x80px) with clock icon (white, 48px)

Urgency Message (centered, 16px below icon):
- "Your Trial Ends Soon" (Heading/Display-1, gray-900)
- Days remaining (Heading/H2, orange): "3 Days Left"

Current Benefits Card (16px padding):
- Gradient card (teal, 16px radius, 24px padding):
  - "What You're Currently Enjoying" (Heading/H3, white)
  - Benefits list (auto-layout vertical, 8px gap, Body/Regular, white/90% opacity):
    - ⭐ "Earning 10% SP on sales"
    - 📦 "Unlimited item listings"
    - 💰 "Spend up to 50% SP on purchases"
    - 💬 "Full marketplace access"

What Happens After Trial Card (16px below current benefits):
- Card (red-50 bg, red-600 border-left (4px), 12px radius, 16px padding):
  - "What Changes on [Expiry Date]:" (Heading/H3, red-900)
  - Changes list (auto-layout vertical, 8px gap, Body/Regular, gray-900):
    - ❌ "SP earning stops immediately"
    - ❌ "Cannot list new items for sale"
    - ❌ "SP spend cap reduced to 30%"
    - ❌ "Active listings remain visible until sold"
  - Note (Body/Small, gray-700, 12px above):
    - "You'll keep your existing SP balance and can still shop"

Pricing Reminder (16px below changes):
- Card (gray-50 bg, 12px radius, 16px padding):
  - "Continue for just $4.99/month" (Heading/H3, gray-900, centered)
  - "Cancel anytime" (Body/Regular, gray-600, centered)

Value Calculation (16px below pricing):
- Card (orange-50 bg, 12px radius, 16px padding):
  - "Your Trial Results" (Heading/H3, gray-900)
  - Stats (auto-layout vertical, 8px gap):
    - Row: "Items Sold" + "5" (Body/Regular, gray-700 + Body/Regular-Medium, orange)
    - Row: "SP Earned" + "1,250 SP (~$12.50)" (orange)
    - Row: "Potential Monthly Earnings" + "~$40-60" (orange)
  - Calculation (Body/Small, gray-600):
    - "If you continue selling at this rate, Premium pays for itself!"

Actions Section (fixed to bottom):
- "Subscribe to Premium" button (Button/Primary/Large, full-width)
- "Try Pro Instead" button (Button/Secondary/Large, full-width, 12px below)
- "No Thanks" link (Body/Small, gray-600, centered, 12px below)
  - Warning text below (Body/Small, red-600): "You'll lose SP earning immediately"

---
FIELD INVENTORY — TrialEndingScreen:

INPUT FIELDS (user-editable):
- "Subscribe to Premium" button: navigates to SubscriptionUpgradeScreen (Premium pre-selected)
- "Try Pro Instead" button: navigates to SubscriptionUpgradeScreen (Pro pre-selected)
- "No Thanks" link: dismisses screen (shows "You'll lose SP earning immediately" warning)

DISPLAY FIELDS (read-only):
- Yellow clock icon + "Your Trial Ends Soon" heading (static)
- Days remaining: "3 Days Left" (dynamic: subscription.trial_end − today)
- Current benefits card (gradient teal): SP earn rate, unlimited listings, SP spend cap, marketplace access (dynamic, shows current trial tier's features)
- "What Changes on [Expiry Date]" card (red-50 bg): SP earning stops, cannot list, spend cap reduced to 30% (dynamic — expiry date from subscription.trial_end)
- Pricing reminder: "Continue for just $4.99/month" (static)
- Trial results value card (orange-50 bg): items sold count, SP earned, potential monthly earnings estimate (dynamic from DB)

AUTO-CALCULATED:
- Trial days remaining: subscription.trial_end − today
- Trial results via getTrialResults() RPC: items_sold, sp_earned_total
- Potential earnings estimate: items_sold / trial_days × 30 × avg_SP_per_item
---

SCREEN 2: SubscriptionExpiredScreen
Frame: 375x812px, white background

Alert Icon (centered, 24px from top):
- Red circle (80x80px) with X icon (white, 48px)

Expiry Message (centered, 16px below icon):
- "Your Subscription Expired" (Heading/Display-1, gray-900)
- Expired date (Body/Large, gray-600): "Expired on May 4, 2026"

Impact Card (16px padding):
- Card (red-50 bg, red-600 border-left (4px), 12px radius, 16px padding):
  - "What Changed:" (Heading/H3, red-900)
  - Changes list (auto-layout vertical, 8px gap, Body/Regular, gray-900):
    - ❌ "You can no longer earn SP from sales"
    - ❌ "Cannot create new listings"
    - ❌ "SP spend cap reduced to 30%"
    - ✅ "Your 1,250 SP balance is still available"
    - ✅ "You can still shop and buy items"

What You're Missing Card (16px below impact):
- Card (gray-50 bg, 12px radius, 16px padding):
  - "You're Missing Out On:" (Heading/H3, gray-900)
  - Missed earnings calculator (if user had active listings):
    - Auto-layout vertical, 8px gap:
      - "Active Listings" + "3 items" (Body/Regular, gray-700 + orange)
      - "Potential SP Value" + "~$15-25/month" (gray-700 + orange)
      - "Lost Earnings (30 days)" + "$15-25" (red-600, bold)

Reactivation Offer (16px below missing):
- Gradient card (teal, 16px radius, 24px padding):
  - "Welcome Back Offer" badge (top-center, white bg/20% opacity, white text, pill)
  - "Reactivate Now, Get 100 Bonus SP!" (Heading/H3, white, centered)
  - "Limited time offer" (Body/Regular, white/80% opacity, centered)
  - Terms (Body/Small, white/70% opacity, centered): "Bonus SP awarded after first sale"

Pricing Options (16px below offer):
- Plan cards (auto-layout vertical, 12px gap):

Premium Card:
- White bg, teal-600 border (2px), 12px radius, 16px padding
- "Premium" (Heading/H3, teal-900)
- "$4.99/month" (Body/Large, teal-700)
- Key benefits (Body/Small, gray-700):
  - "Earn 10% SP • List unlimited items"
- "Reactivate Premium" button (Button/Primary/Large)

Pro Card:
- White bg, orange-600 border (2px), 12px radius, 16px padding
- "Pro" (Heading/H3, orange-900)
- "$9.99/month" (Body/Large, orange-700)
- "Best Value" badge (orange bg, white text, pill, top-right)
- Key benefits:
  - "Earn 13% SP • Priority support • 70% SP spending"
- "Upgrade to Pro" button (Button/Secondary/Large)

Actions:
- "Maybe Later" link (Body/Small, gray-600, centered, 16px below cards)

---
FIELD INVENTORY — SubscriptionExpiredScreen:

INPUT FIELDS (user-editable):
- "Reactivate Premium" button: initiates Premium subscription reactivation via Stripe
- "Upgrade to Pro" button: initiates Pro subscription via Stripe
- "Maybe Later" link: dismisses screen, continues with Free plan restrictions

DISPLAY FIELDS (read-only):
- Red X icon + "Your Subscription Expired" heading (static)
- Expired date: "Expired on [date]" (dynamic from subscription.current_period_end)
- Impact card (red-50 bg): SP earning stopped, cannot create new listings, SP spend cap reduced to 30%, SP balance preserved, still able to shop (dynamic, tier-dependent)
- What You're Missing card (conditional): active listing count + potential SP value/month + lost earnings estimate (dynamic — shown only if user has active listings)
- Reactivation offer card (gradient, conditional): "Welcome Back — Get 100 Bonus SP!" + "Limited time offer" (conditional, admin-configured bonus)
- Pricing cards: Premium ($4.99/mo) + Pro ($9.99/mo Best Value badge) with key feature summaries (static)

AUTO-CALCULATED:
- Expired date from subscription.current_period_end
- Potential missed earnings: active_listings_count × avg_sale_frequency × avg_SP_per_sale
- isEligibleForWelcomeBackBonus from admin config + subscription history
---

SCREEN 3: PaymentFailedScreen
Frame: 375x812px, white background

Alert Icon (centered, 24px from top):
- Orange circle (80x80px) with credit card slash icon (white, 48px)

Payment Issue Message (centered, 16px below icon):
- "Payment Failed" (Heading/Display-1, gray-900)
- "We couldn't process your payment" (Body/Large, gray-600)

Payment Details Card (16px padding):
- Card (orange-50 bg, orange-600 border-left (4px), 12px radius, 16px padding):
  - "Payment Information" (Heading/H3, gray-900)
  - Details (auto-layout vertical, 8px gap):
    - Row: "Amount" + "$9.99" (Body/Regular, gray-700 + gray-900)
    - Row: "Card" + "Visa **** 4242" (gray-700 + gray-900)
    - Row: "Attempt Date" + "May 4, 2026" (gray-700 + gray-900)
    - Row: "Error" + "Card declined" (gray-700 + red-600)

Grace Period Banner (16px below payment):
- Yellow-50 bg, yellow-600 border-left (4px), 12px padding
- Warning icon (20px, yellow-700) + Text (Body/Regular, yellow-900):
  - "You have 7 days to update your payment before your subscription is cancelled"
  - Grace period countdown: "6 days remaining"

What Happens If Not Fixed (16px below banner):
- Card (gray-50 bg, 12px radius, 16px padding):
  - "If payment isn't updated by [Date]:" (Heading/H3, gray-900)
  - Consequences (auto-layout vertical, 8px gap, Body/Regular, gray-700):
    - "• Subscription will be cancelled"
    - "• SP earning will stop immediately"
    - "• Cannot create new listings"
    - "• Existing SP balance remains available"

Payment Method Section (16px below consequences):
- "Update Payment Method" (Heading/H3, gray-900)
- Current card display:
  - Card icon + "Visa **** 4242" (Body/Regular, gray-700)
  - Status: "Declined" (red-600)
- "Change Card" button (Button/Secondary/Medium, 12px below)

Alternative Payment Card (16px below payment section):
- Card (teal-50 bg, 12px radius, 16px padding):
  - "Try a different payment method" (Body/Regular-Medium, gray-900)
  - Methods (auto-layout horizontal, 12px gap):
    - Credit card icon
    - Debit card icon
    - Apple Pay icon
    - Google Pay icon

Actions Section (fixed to bottom):
- "Update Payment Now" button (Button/Primary/Large, full-width)
- "Contact Support" link (Body/Small, orange, centered, 12px below)
- "Cancel Subscription" link (Body/Small, gray-600, centered, 12px below)

---
FIELD INVENTORY — PaymentFailedScreen:

INPUT FIELDS (user-editable):
- "Update Payment Now" button: opens Stripe payment method update sheet
- "Change Card" button (Payment Method section): opens card update flow
- "Contact Support" link: navigates to ContactSupportScreen
- "Cancel Subscription" link: navigates to SubscriptionCancellationScreen

DISPLAY FIELDS (read-only):
- Orange credit-card-slash icon + "Payment Failed" heading (static)
- Payment details card (orange-50 bg): amount, masked card number, attempt date, error reason "Card declined" (dynamic from Stripe webhook data)
- Grace period banner (yellow-50 bg): "7 days to update payment before subscription is cancelled" + countdown "X days remaining" (dynamic)
- Consequences card (gray-50 bg): subscription will cancel, SP earning stops, cannot list, SP balance preserved (static)
- Current payment method display: card brand + masked number + "Declined" status in red (dynamic)
- Alternative payment method icons: credit/debit card, Apple Pay, Google Pay (static)

AUTO-CALCULATED:
- Grace period days remaining: failed_payment_date + 7 − today
- Payment error reason from Stripe decline_code on subscription invoice
---

SCREEN 4: SubscriptionPausedScreen
Frame: 375x812px, white background

Pause Icon (centered, 24px from top):
- Gray circle (80x80px) with pause icon (white, 48px)

Pause Message (centered, 16px below icon):
- "Subscription Paused" (Heading/Display-1, gray-900)
- "Your account is temporarily paused" (Body/Large, gray-600)

Pause Reason Card (16px padding):
- Card (gray-100 bg, gray-400 border-left (4px), 12px radius, 16px padding):
  - Icon (24px, gray-600, info) + "Why was this paused?" (Heading/H3, gray-900)
  - Reason (Body/Regular, gray-700):
    - "Your subscription was paused due to [Reason]:"
    - Possible reasons:
      - "Multiple failed payment attempts"
      - "Suspicious activity detected"
      - "Account under review"
      - "Request from support team"

Current Status Card (16px below reason):
- Card (white bg, gray-200 border, 12px radius, 16px padding):
  - "What You Can Do:" (Heading/H3, gray-900)
  - Allowed actions (auto-layout vertical, 8px gap):
    - ✅ Checkmark (green) + "Shop and buy items" (Body/Regular, gray-700)
    - ✅ "Use existing SP balance (up to 30%)"
    - ✅ "Message buyers and sellers"
    - ❌ X (red) + "Earn SP from sales"
    - ❌ "Create new listings"
    - ❌ "Access Pro features"

Resolution Steps Card (16px below status):
- Card (teal-50 bg, 12px radius, 16px padding):
  - "How to Reactivate:" (Heading/H3, gray-900)
  - Steps (auto-layout vertical, 12px gap):
    - Step 1:
      - Number (24px circle, teal-600 bg, white text): "1"
      - "Update your payment method" (Body/Regular, gray-900)
      - "Change Card" button (Button/Tertiary/Small)
    - Step 2:
      - Number (teal bg): "2"
      - "Contact our support team" (Body/Regular, gray-900)
      - "Contact Support" button (Button/Tertiary/Small)
    - Step 3:
      - Number (teal bg): "3"
      - "Wait for account review (24-48 hours)" (Body/Regular, gray-900)

Support Contact Card (16px below resolution):
- Card (white bg, gray-200 border, 12px radius, 16px padding):
  - "Need Help?" (Heading/H3, gray-900)
  - "Our support team is ready to assist" (Body/Regular, gray-700)
  - "support@passitup.app" (Body/Regular, teal-700, underline)
  - Response time (Body/Small, gray-500): "⏱ Avg. response: 2-4 hours"

Actions Section (fixed to bottom):
- "Contact Support" button (Button/Primary/Large, full-width)
- "View Account Status" button (Button/Secondary/Large, full-width, 12px below)

---
FIELD INVENTORY — SubscriptionPausedScreen:

INPUT FIELDS (user-editable):
- "Change Card" button (Resolution Step 1): opens Stripe payment method update sheet
- "Contact Support" button (Resolution Step 2): navigates to ContactSupportScreen
- "Contact Support" button (fixed bottom): navigates to ContactSupportScreen
- "View Account Status" button: navigates to SubscriptionManagementScreen
- "support@passitup.app" link: opens email client

DISPLAY FIELDS (read-only):
- Gray pause icon + "Subscription Paused" heading (static)
- Pause reason card (gray-100 bg): dynamic reason text (e.g., "Multiple failed payment attempts" / "Account under review") (dynamic from subscription record)
- Current status card: what you can/cannot do — ✓ shop/spend SP/message; ✗ earn SP/list/Pro features (static)
- Resolution steps card (teal-50 bg): 3-step numbered guide (1: Update payment, 2: Contact support, 3: Wait 24–48h) (static)
- Support contact card: email + avg response time (static)

AUTO-CALCULATED:
- Pause reason and timestamp from subscription.status + subscription.pause_reason fields
- Account capability flags derived from subscription.status = 'paused'
---

NAVIGATION FLOW:
- Trial ending notification → Trial Ending Screen → Subscribe → Payment → Success
- Subscription expired → Expired Screen → Reactivate → Payment → Success
- Payment failed notification → Payment Failed Screen → Update card → Retry → Success/Failure
- Account paused (admin action) → Paused Screen → Contact Support → Resolution

FIGMA-SPECIFIC REQUIREMENTS:

- AI Empowerment: Treat these requirements as a starting point. Please provide suggestions for UI/UX improvements, alternative screen layouts, or propose new screens if they create a more ideal user experience.
- AI Collaboration: Please ask clarification questions or push back on any requirements that do not make structural or UX sense.
- Dependencies: Call out any design or flow dependencies you encounter while reading the prompts.
- Recommendations: For any questions or pushback, please provide your specific recommendations for how to proceed.

- Prototype Configuration: Use "Smart Animate" for transitions (300ms ease-in-out)
- Prototype Configuration: Configure overflow scrolling for long content areas
- Prototype Configuration: Add bottom tab bar navigation to all applicable screens
- Prototype Configuration: Link all modal overlays to dismiss on background tap
- Prototype Configuration: Configure keyboard navigation for form flows
- Status icon variants (clock/X/credit-card/pause with colored circles)
- Urgency countdown component (days/hours remaining)
- Impact card component (what changes, color-coded with checkmarks/X icons)
- Value calculator (trial results, missed earnings)
- Payment method display with status indicator
- Grace period countdown banner
- Resolution steps component (numbered steps)
- Interactive prototype: trial reminder → subscribe flow, payment update flow
- Create reactivation offer card (gradient with badge)
- Multi-state subscription cards (expired/paused/payment-failed)
```

---

## FLOW-18: CPSC Recalls & Admin-Initiated Actions

**Priority**: P1 (High) — Safety compliance, admin enforcement

```
Design safety and admin enforcement screens. Reference app-overview.md (CPSC integration, safety focus), design-system.md, and screen-flow-mapping.md FLOW-18.

SCREENS TO DESIGN (4 total):
1. RecallAlertScreen (already designed in FLOW-04, reuse that design)
2. AccountSuspendedScreen
3. ListingRemovedScreen
4. DisputeResolutionScreen

Use design-system.md components, emphasize safety, clear communication of violations, appeal process.

---

SCREEN 1: RecallAlertScreen
**NOTE**: This screen was already designed in FLOW-04 as "ListingSafetyReviewScreen". 

Reuse that design here. For reference, it includes:
- Red alert banner with CPSC recall details
- Item preview card showing flagged listing
- Remediation URL to CPSC recall page
- "Remove Listing" and "Appeal This Decision" actions
- Appeal modal with explanation textarea

---

SCREEN 2: AccountSuspendedScreen
Frame: 375x812px, white background

Alert Icon (centered, 24px from top):
- Red circle (120x120px) with lock icon (white, 64px)

Suspension Message (centered, 16px below icon):
- "Account Suspended" (Heading/Display-1, red-900)
- "Your account has been temporarily suspended" (Body/Large, gray-700)

Suspension Details Card (16px padding):
- Card (red-50 bg, red-600 border-left (4px), 12px radius, 16px padding):
  - "Suspension Information" (Heading/H3, red-900)
  - Details (auto-layout vertical, 8px gap):
    - Row: "Effective Date" + "May 4, 2026 at 2:30 PM" (Body/Regular, gray-700 + gray-900)
    - Row: "Suspension ID" + "SUS-A1B2C3" (gray-700 + monospace gray-900)
    - Row: "Duration" + "7 days" OR "Indefinite pending review" (gray-700 + red-600)
    - Row: "Reason" + violation reason (gray-700 + gray-900)

Reason Card (16px below details):
- Card (white bg, gray-200 border, 12px radius, 16px padding):
  - "Why was my account suspended?" (Heading/H3, gray-900)
  - Violation description (Body/Regular, gray-700):
    - Specific violation explanation
    - Examples:
      - "Multiple policy violations detected"
      - "Sale of prohibited items"
      - "Fraudulent activity suspected"
      - "Buyer/seller complaints"
      - "Payment disputes"
  - Policy reference (Body/Small, gray-600):
    - "This violates our Community Guidelines Section [X]"
    - "View Full Policy" link (teal-700, underline)

Evidence Section (if applicable, 16px below reason):
- Card (gray-50 bg, 12px radius, 16px padding):
  - "Related Items/Trades" (Heading/H3, gray-900)
  - Evidence list (auto-layout vertical, 8px gap):
    - Item card (compact):
      - Thumbnail (60x60px) + Title + "Flagged: [Reason]"
      - "View Details" link (teal-700, underline)

Impact Card (16px below evidence):
- Card (yellow-50 bg, yellow-600 border-left (4px), 12px radius, 16px padding):
  - "What This Means:" (Heading/H3, gray-900)
  - Restrictions list (auto-layout vertical, 8px gap, Body/Regular, gray-700):
    - ❌ "Cannot buy or sell items"
    - ❌ "Cannot access SP wallet"
    - ❌ "Cannot send or receive messages"
    - ❌ "Active listings have been hidden"
    - ✅ "Your data remains secure"

Appeal Process Card (16px below impact):
- Card (teal-50 bg, 12px radius, 16px padding):
  - "How to Appeal:" (Heading/H3, gray-900)
  - Steps (auto-layout vertical, 12px gap):
    - Step 1:
      - Number (24px circle, teal-600 bg, white): "1"
      - "Review the suspension reason above" (Body/Regular, gray-900)
    - Step 2:
      - Number: "2"
      - "Submit an appeal explaining your case" (Body/Regular, gray-900)
    - Step 3:
      - Number: "3"
      - "Our team will review within 24-48 hours" (Body/Regular, gray-900)
    - Step 4:
      - Number: "4"
      - "You'll receive a decision via email" (Body/Regular, gray-900)

Appeal Form (16px below process):
- "Submit Your Appeal" (Heading/H3, gray-900)
- Textarea (Form-Input/Default, 6 rows):
  - Placeholder: "Explain why you believe this suspension is incorrect..."
  - Character counter: "0/1000"
- File upload (optional):
  - "Add Supporting Documents" (Body/Regular-Medium, gray-900)
  - Upload zone (gray-100 bg, dashed border)

Contact Support Card (16px below form):
- Card (white bg, gray-200 border, 12px radius, 16px padding):
  - "Questions About Your Suspension?" (Heading/H3, gray-900)
  - "Contact our support team for clarification" (Body/Regular, gray-700)
  - "support@passitup.app" (Body/Regular, teal-700, underline)

Actions Section (fixed to bottom):
- "Submit Appeal" button (Button/Primary/Large, full-width)
  - Disabled until appeal text provided (min 50 chars)
- "Contact Support" button (Button/Secondary/Large, full-width, 12px below)
- "View Community Guidelines" link (Body/Small, gray-600, centered, 12px below)

Appeal Submitted State (replace form after submission):
- Green checkmark (64px)
- "Appeal Submitted" (Heading/H3, green-600, centered)
- "We'll review your appeal within 24-48 hours" (Body/Regular, gray-700, centered)
- "You'll receive our decision via email" (Body/Small, gray-600, centered)

---
FIELD INVENTORY — AccountSuspendedScreen:

INPUT FIELDS (user-editable):
- Appeal reason textarea: required, min 50 / max 1000 chars, placeholder "Explain why you believe this suspension is incorrect..."
- Supporting documents upload: optional file upload (photos, screenshots)
- "Submit Appeal" button: submits suspension appeal (disabled until textarea ≥50 chars)
- "Contact Support" button: navigates to ContactSupportScreen
- "View Community Guidelines" link: opens external community guidelines
- "View Full Policy" link (policy reference card): navigates to relevant policy section

DISPLAY FIELDS (read-only):
- Red lock icon (120×120px) + "Account Suspended" heading (static)
- Suspension details card (red-50 bg): effective date, suspension ID (monospace), duration, reason text (dynamic from DB)
- Reason card: specific violation description + policy reference section (dynamic from admin action)
- Evidence section (conditional): flagged items/trades list with thumbnails and "Flagged: [reason]" (dynamic, shown only if admin provided evidence)
- Impact card (yellow-50 bg): restricted actions (cannot buy/sell/message/wallet/listings) vs. data security preserved (dynamic, flags adapted to suspension type)
- Appeal process steps (teal-50 bg): 4-step numbered guide (static)
- Post-submission state: green checkmark + "Appeal Submitted" (conditional, replaces form after submit)

AUTO-CALCULATED:
- Suspension data from account_flags or suspension_records table
- submitSuspensionAppeal() RPC on Submit
---

SCREEN 3: ListingRemovedScreen
Frame: 375x812px, white background

Alert Icon (centered, 24px from top):
- Orange circle (80x80px) with alert triangle icon (white, 48px)

Removal Message (centered, 16px below icon):
- "Listing Removed" (Heading/Display-1, gray-900)
- "Your listing has been removed from the marketplace" (Body/Large, gray-700)

Listing Preview Card (16px padding):
- Card (white bg, gray-200 border, 12px radius, 16px padding):
  - "Removed Listing" (Body/Regular-Medium, gray-900)
  - Item thumbnail (120x120px, centered, grayed out filter)
  - Title (Body/Large-Medium, gray-900, centered)
  - "Removed on May 4, 2026" (Body/Small, gray-600, centered)

Removal Reason Card (16px below preview):
- Card (orange-50 bg, orange-600 border-left (4px), 12px radius, 16px padding):
  - "Reason for Removal" (Heading/H3, gray-900)
  - Icon (32px, orange-600) + Violation type (Body/Regular-Medium, gray-900):
    - "Prohibited Item"
    - "Policy Violation"
    - "Safety Concern"
    - "CPSC Recall"
    - "Counterfeit Suspected"
    - "Inappropriate Content"
  - Detailed explanation (Body/Regular, gray-700):
    - Specific reason why listing was removed
  - Policy reference (Body/Small, gray-600):
    - "This violates our Listing Policy Section [X]"
    - "View Full Policy" link (orange, underline)

Evidence Section (if applicable, 16px below reason):
- Card (gray-50 bg, 12px radius, 16px padding):
  - "Why We Made This Decision:" (Heading/H3, gray-900)
  - Evidence points (auto-layout vertical, 8px gap, Body/Regular, gray-700):
    - Bullet points explaining detection:
      - "• Product matches CPSC recall database"
      - "• Multiple user reports received"
      - "• Automated content scanning flagged images"
      - "• Price significantly below market (scam indicator)"

What Happens Next Card (16px below evidence):
- Card (white bg, gray-200 border, 12px radius, 16px padding):
  - "What Happens Now:" (Heading/H3, gray-900)
  - Actions (auto-layout vertical, 8px gap, Body/Regular, gray-700):
    - ✅ "Your account remains active"
    - ✅ "Other listings are unaffected"
    - ✅ "You can create new compliant listings"
    - ⚠️ "Repeated violations may result in account suspension"

Remediation Section (16px below what happens):
- Card (teal-50 bg, 12px radius, 16px padding):
  - "Avoid Future Removals:" (Heading/H3, gray-900)
  - Tips (auto-layout vertical, 8px gap, Body/Small, gray-700):
    - "✓ Review our listing policies before posting"
    - "✓ Verify items aren't recalled at cpsc.gov"
    - "✓ Use accurate descriptions and photos"
    - "✓ Price items reasonably"
  - "View Listing Guidelines" link (Body/Regular, teal-700, underline)

Appeal Option (if applicable, 16px below remediation):
- "Believe this was a mistake?" (Heading/H3, gray-900)
- Appeal textarea (Form-Input/Default, 4 rows):
  - Placeholder: "Explain why you believe this listing should be restored..."
- "Submit Appeal" button (Button/Secondary/Medium)
- Note (Body/Small, gray-600): "Appeals are reviewed within 24 hours"

Actions Section (fixed to bottom):
- "Create New Listing" button (Button/Primary/Large, full-width)
- "View Listing Guidelines" button (Button/Secondary/Large, full-width, 12px below)
- "Contact Support" link (Body/Small, orange, centered, 12px below)

---
FIELD INVENTORY — ListingRemovedScreen:

INPUT FIELDS (user-editable):
- Appeal textarea: optional, explains why removal was a mistake (min 10 chars)
- "Submit Appeal" button: submits listing removal appeal
- "Create New Listing" button: navigates to ItemCreateScreen
- "View Listing Guidelines" button: opens external listing policy
- "Contact Support" link: navigates to ContactSupportScreen
- "View Full Policy" link (policy reference): navigates to policy section

DISPLAY FIELDS (read-only):
- Orange alert triangle icon + "Listing Removed" heading (static)
- Removed listing preview card: grayed-out thumbnail, title, "Removed on [date]" (dynamic from DB)
- Removal reason card (orange-50 bg): violation type icon + label (e.g., "CPSC Recall" / "Prohibited Item" / "Policy Violation") + detailed explanation + policy reference (dynamic from admin action)
- Evidence section (conditional): detection reasoning bullets (e.g., CPSC match, user reports, content scan) (dynamic, shown if admin provided evidence notes)
- What Happens Now card: account active, other listings unaffected, can create new listings, repeated violations warning (static)
- Remediation tips card (teal-50 bg): policy compliance tips + listing guidelines link (static)
- Appeal status badge (conditional): "In Review" / "Rejected" / "Pending" (dynamic, shown after appeal submitted)

AUTO-CALCULATED:
- Listing removal data from listings table (status = 'removed', admin_notes, removal_reason)
- submitListingRemovalAppeal() RPC on submit
---

SCREEN 4: DisputeResolutionScreen
Frame: 375x812px, white background

Header:
- Back button (top-left)
- "Dispute Resolution" title (Heading/H2, gray-900, centered)

Dispute Status Card (16px padding):
- Status badge (large, centered):
  - "Under Review" (yellow-100 bg, yellow-800 text)
  - "Resolved" (green-100 bg, green-800 text)
  - "Closed" (gray-200 bg, gray-700 text)
- Dispute ID (Body/Small, gray-500, monospace): "DIS-A1B2C3D4"
- Filed date (Body/Small, gray-600): "May 4, 2026"

Dispute Type Card (16px below status):
- Card (white bg, gray-200 border, 12px radius, 16px padding):
  - Icon (32px, category color) + Type (Heading/H3, gray-900):
    - "Item Not as Described"
    - "Item Not Received"
    - "Payment Issue"
    - "Seller/Buyer Conduct"
    - "Refund Request"
  - Filed by (Body/Small, gray-600): "Buyer" OR "Seller"

Related Trade Section (16px below type):
- Card (teal-50 bg, 12px radius, 16px padding):
  - "Related Trade" (Body/Regular-Medium, gray-900)
  - Item thumbnail (80x80px, 8px radius)
  - Title (Body/Regular, gray-900)
  - Trade ID (Body/Small, gray-600, monospace): "TXN-A1B2C3D4"
  - "View Trade Details" link (Body/Small, teal-700, underline)

Parties Section (16px below trade):
- Auto-layout horizontal, 12px gap, equal width:
  - Buyer card:
    - "Buyer" label (Body/Small, gray-600)
    - Avatar (48px)
    - Name (Body/Regular-Medium, gray-900)
    - Status: "Claimant" OR "Respondent" (yellow-100 bg, yellow-800 text, pill)
  - Seller card (same layout)

Dispute Details Section (16px below parties):
- Card (white bg, gray-200 border, 12px radius, 16px padding):
  - "Dispute Details" (Heading/H3, gray-900)
  - Claim (Body/Regular, gray-700):
    - Claimant's description of the issue
  - Evidence (if provided):
    - "Evidence Provided:" (Body/Small-Medium, gray-900)
    - Image thumbnails (if photos submitted)
    - "View All Evidence" link (teal-700, underline)

Resolution Timeline (16px below details):
- "Resolution Process" (Heading/H3, gray-900)
- Timeline component (auto-layout vertical, 16px gap):
  - Step 1 (completed):
    - Green checkmark (24px) + "Dispute Filed" + date
  - Step 2 (completed):
    - Green checkmark + "Respondent Notified" + date
  - Step 3 (current):
    - Yellow clock (24px) + "Under Review by Support Team"
    - Est. completion: "24-48 hours from filing"
  - Step 4 (pending):
    - Gray circle + "Decision Communicated"
  - Step 5 (pending):
    - Gray circle + "Dispute Closed"

Communication Thread (16px below timeline):
- "Communication" (Heading/H3, gray-900)
- Message thread (same bubble design as messaging):
  - Claimant messages
  - Respondent messages
  - Support team messages
  - System messages

Response Input (if user is respondent and hasn't responded):
- "Your Response" (Heading/H3, gray-900)
- Textarea (Form-Input/Default, 6 rows):
  - Placeholder: "Provide your response to this dispute..."
- File upload (optional):
  - "Add Evidence (photos, receipts, etc.)"
  - Upload zone
- "Submit Response" button (Button/Primary/Large)

Resolution Decision (if resolved, 16px below thread):
- Card (green-50 bg OR red-50 bg, green/red border-left (4px), 12px radius, 16px padding):
  - "Dispute Resolved" (Heading/H3, gray-900)
  - Decision (Body/Regular-Medium, gray-900):
    - "Resolution: [Outcome]"
    - Outcomes:
      - "Refund issued to buyer"
      - "Item must be returned to seller"
      - "Seller retained payment"
      - "Partial refund agreed"
      - "No action required"
  - SP handling (if applicable, Body/Regular, gray-700):
    - "SP has been [released/returned/held]"
  - Explanation (Body/Regular, gray-700):
    - Reasoning for decision
  - Next steps (Body/Small, gray-600):
    - What each party needs to do

Appeal Option (if dissatisfied with resolution):
- Card (yellow-50 bg, 12px radius, 16px padding):
  - "Not satisfied with this decision?" (Body/Regular-Medium, gray-900)
  - "You can appeal within 7 days" (Body/Regular, gray-700)
  - "Submit Appeal" button (Button/Tertiary/Medium)

Actions Section (fixed to bottom):
- If under review:
  - "Add Information" button (Button/Primary/Large, full-width)
  - "Contact Support" link (Body/Small, orange, centered, 12px below)
- If resolved:
  - "Close Dispute" button (Button/Primary/Large, full-width)
  - "Download Summary" link (Body/Small, gray-600, centered, 12px below)

---
FIELD INVENTORY — DisputeResolutionScreen:

INPUT FIELDS (user-editable):
- Response textarea (respondent only, if not yet responded): required, freeform explanation of their side
- Evidence upload (optional): photos, receipts, screenshots
- "Submit Response" button: submits respondent's reply (disabled until textarea has content)
- "Add Information" button (under review, fixed bottom): opens additional info textarea
- "Close Dispute" button (resolved state): closes the resolved dispute
- "Submit Appeal" button (appeal card, if dissatisfied): submits appeal of resolution decision
- "Contact Support" link: navigates to ContactSupportScreen
- "Download Summary" link: downloads dispute PDF summary
- "View Trade Details" link: navigates to TradeDetailScreen

DISPLAY FIELDS (read-only):
- Dispute status badge: Under Review (yellow) | Resolved (green) | Closed (gray) (dynamic)
- Dispute ID (monospace): "DIS-A1B2C3D4" (dynamic)
- Filed date (dynamic)
- Dispute type card: icon + type label (Item Not as Described / Not Received / Payment Issue / Conduct / Refund) + filed by (Buyer/Seller) (dynamic)
- Related trade card (teal-50 bg): item thumbnail, title, trade ID + "View Trade Details" link (dynamic)
- Parties section: buyer and seller avatars, names, role badge (Claimant/Respondent) (dynamic)
- Dispute details card: claimant's description text + submitted evidence images (dynamic)
- Resolution timeline: 5 steps — Dispute Filed / Respondent Notified / Under Review / Decision Made / Dispute Closed (step states: completed/current-pulsing/future) (dynamic)
- Communication thread: claimant bubbles, respondent bubbles, support agent bubbles, system messages (dynamic from DB)
- Resolution decision card (conditional, green-50 or red-50): outcome, SP handling status, explanation, next steps (shown when dispute.status = resolved)
- Appeal option card (conditional, yellow-50 bg): "Not satisfied? Appeal within 7 days" (shown when resolved)

AUTO-CALCULATED:
- Timeline step states derived from dispute.status state machine
- getDisputeById(disputeId) with full message thread
- submitDisputeResponse() on Submit
---

NAVIGATION FLOW:
- CPSC recall detected (background) → Push notification → Recall Alert Screen → Remove/Appeal
- Admin flags listing → Push notification → Listing Removed Screen → View reason → Appeal/Create new
- Account violation → Admin action → Account Suspended Screen → Submit appeal → Resolution
- Trade dispute filed → Both parties notified → Dispute Resolution Screen → Communication → Decision

FIGMA-SPECIFIC REQUIREMENTS:

- AI Empowerment: Treat these requirements as a starting point. Please provide suggestions for UI/UX improvements, alternative screen layouts, or propose new screens if they create a more ideal user experience.
- AI Collaboration: Please ask clarification questions or push back on any requirements that do not make structural or UX sense.
- Dependencies: Call out any design or flow dependencies you encounter while reading the prompts.
- Recommendations: For any questions or pushback, please provide your specific recommendations for how to proceed.

- Prototype Configuration: Use "Smart Animate" for transitions (300ms ease-in-out)
- Prototype Configuration: Configure overflow scrolling for long content areas
- Prototype Configuration: Add bottom tab bar navigation to all applicable screens
- Prototype Configuration: Link all modal overlays to dismiss on background tap
- Prototype Configuration: Configure keyboard navigation for form flows
- Status icon variants (lock/alert/shield with colored circles: red/orange/yellow)
- Violation card component with color-coded borders (red/orange/yellow based on severity)
- Evidence display component (image grid, expandable)
- Appeal form with file upload
- Timeline component with step states (completed/current/pending)
- Dispute resolution decision card (approved/denied variants)
- Communication thread (reuse messaging bubbles from FLOW-13)
- Interactive prototype: submit appeal, view evidence, respond to dispute
- Create policy reference component (section number + link)
- Multi-state screens (under review/resolved/closed)
```

---

## 🎉 100% COMPLETE! Document 4 (Figma Agent Prompts) Finished!

Congratulations! You now have **18 comprehensive Figma prompts** ready for Figma Make implementation:

### ✅ ALL FLOWS COMPLETED:

**Authentication & Onboarding (P0)**
- ✅ FLOW-01: Authentication (7 screens)
- ✅ FLOW-02: Profiles & Onboarding (5 screens)
- ✅ FLOW-03: Node/ZIP Gating (2 screens)

**Marketplace Core (P0)**
- ✅ FLOW-06: Discovery (3 screens)
- ✅ FLOW-04: Listing Management (5 screens)
- ✅ FLOW-05: Media Upload (integrated)
- ✅ **FLOW-07: Cart & Bundling (2 screens) — NEW, MVP-CRITICAL**

**Transactions (P0)**
- ✅ FLOW-08: Trade Flow (6 screens)
- ✅ FLOW-09: Fees & Pricing (integrated)

**Loyalty Program (P0/P1)**
- ✅ FLOW-10: SP Wallet (3 screens)
- ✅ FLOW-11: SP Earn/Spend Logic (4 components)
- ✅ FLOW-12: Subscription Management (4 screens)
- ✅ FLOW-17: Subscription Events (4 screens)

**Communication (P1)**
- ✅ FLOW-13: Messaging (3 screens)
- ✅ FLOW-15: Notifications (2 screens)

**Growth & Support (P1/P2)**
- ✅ FLOW-14: Referral Program (2 screens)
- ✅ FLOW-16: Support & Help Center (4 screens)

**Safety & Compliance (P1)**
- ✅ FLOW-18: CPSC Recalls & Admin Actions (4 screens)

---

## FLOW-19: Trading Education & Help Center

**Priority**: P1 (High) — User onboarding, SP literacy, ongoing help

```
Design the trading education and help screens. Reference app-overview.md Section 4.1 (SP mechanics, earning rates, subscription tiers), design-system.md, and screen-flow-mapping.md FLOW-19.

SCREENS TO DESIGN (3 total):
1. OnboardingEducationCarousel (first-time users, 4 illustrated slides)
2. HelpScreen (always-accessible, Settings → Help)
3. SPCalculatorWidget (embedded component in HelpScreen + ItemCreateScreen)

Use design-system.md components, Samsung Food aesthetic, warm educational tone.

---

SCREEN 1: OnboardingEducationCarousel
Frame: 375x812px, white background
Trigger: First app open after signup (shown once — onboarding_completed_at IS NULL)

Navigation Controls:
- Dot progress indicator (centered, 16px below content)
- "Skip" link (top-right, Body/Small, gray-600, 44x44px tap target)
- "Next" button (Button/Primary/Large, full-width, 24px bottom padding)
- "Get Started" button (last slide, replaces Next, Button/Primary/Large, orange)

Slide 1 — "Welcome to Pass It Up":
- Illustration (280x220px, centered, 60px top): Families swapping kids items, warm colors
- "Pass It Up" wordmark (Heading/H1, orange, centered, 16px below illustration)
- Body text (Body/Large, gray-700, centered, 24px horizontal padding): "Your local marketplace for kids items — buy, sell, and earn rewards together"

Slide 2 — "Earn Swap Points":
- Illustration (280x220px): Coins, star badges, celebration effect (teal + orange palette)
- "Earn Swap Points" (Heading/H1, gray-900, centered)
- Body text: "Sell items and earn Swap Points (SP). Use SP to save on your next purchase — up to 30-70% of the item price."
- SP example pill (orange-50 bg, 12px radius): "Sell $24 item → Earn ~250 SP (~$2.50)"
- Note (Body/Small, gray-600): "Active Premium or Pro subscription required to earn SP"

Slide 3 — "Safe Local Trading":
- Illustration (280x220px): Handshake, location pin, neighborhood scene (teal palette)
- "Trade Safely" (Heading/H1, gray-900, centered)
- Body text: "Meet in public places, inspect items before pickup, and use our in-app messaging to coordinate."
- Safety tip pill (teal-50 bg, 12px radius, teal-600 border-left): "🛡️ Always meet in busy public locations"

Slide 4 — "Sustainable Shopping":
- Illustration (280x220px): Recycling arrows, Earth, kids items (green + orange palette)
- "Good for Kids, Good for the Planet" (Heading/H1, gray-900, centered)
- Body text: "Give quality kids items a second life. Every item passed on keeps it out of the landfill."
- Stats row (auto-layout horizontal, 24px gap, centered): "🌱 Eco-Friendly" | "♻️ Reduce Waste" | "💰 Save Money"

FIGMA-SPECIFIC REQUIREMENTS:

- AI Empowerment: Treat these requirements as a starting point. Please provide suggestions for UI/UX improvements, alternative screen layouts, or propose new screens if they create a more ideal user experience.
- AI Collaboration: Please ask clarification questions or push back on any requirements that do not make structural or UX sense.
- Dependencies: Call out any design or flow dependencies you encounter while reading the prompts.
- Recommendations: For any questions or pushback, please provide your specific recommendations for how to proceed.

- Prototype Configuration: Use "Smart Animate" for transitions (300ms ease-in-out)
- Prototype Configuration: Configure overflow scrolling for long content areas
- Prototype Configuration: Add bottom tab bar navigation to all applicable screens
- Prototype Configuration: Link all modal overlays to dismiss on background tap
- Prototype Configuration: Configure keyboard navigation for form flows
- Auto-advance animation option (optional — set timeout or require tap)
- Swipe gesture support for slide navigation (prototype)
- Illustration budget: $20-40 (or use Storyset.com free customizable illustrations)
- Dot indicator variant component (active = orange filled, inactive = gray-300)
- Interactive prototype: swipe/tap to advance, skip navigates to Home

---

SCREEN 2: HelpScreen
Frame: 375x812px, white background
Navigation: Settings → "How Trading Works" OR deep link ?section=sp_spending

Header:
- Back button (top-left, 44x44px)
- "How Trading Works" (Heading/H2, gray-900, centered)
- Pull-to-refresh indicator (top)

Accordion Sections (auto-layout vertical, 12px gap, 16px padding):

Section Card Component (reusable, auto-height):
- Frame: white bg, gray-200 border (1px), 12px radius
- Header row (auto-layout horizontal, space-between, 16px padding):
  - Section icon (24px, orange-600, left): varies per section
  - Section title (Body/Regular-Medium, gray-900, flex-grow)
  - Chevron icon (20px, gray-600, right): rotates 180deg when expanded
- Content area (16px horizontal padding, 12px bottom, hidden when collapsed):
  - Body text (Body/Regular, gray-700, line-height 24px)
  - Newlines preserved (white-space: pre-line equivalent)

4 Default Sections (DB-configurable, seeded content):
1. "What are Swap Points?" (star icon, orange): SP definition + earning mechanic overview
2. "How do I earn SP?" (trending-up icon, teal): Selling process, subscription requirement, pending release
3. "How do I spend SP?" (gift icon, orange): Checkout flow, admin-configurable cap, cash equivalent
4. "Trading Safety Tips" (shield icon, teal): Meet in public, inspect items, report issues

SP Calculator Section (16px below accordion):
- Section header (Heading/H3, gray-900): "SP Calculator"
- SPCalculatorWidget (see component spec below)

Bonus Categories Section (16px below calculator):
- "Bonus SP Categories" (Heading/H3, gray-900)
- "Earn extra SP when selling items in these categories" (Body/Small, gray-600)
- Category badges list (auto-layout vertical, 8px gap):
  - Badge card (white bg, orange-100 border, 10px radius, 12px padding, auto-layout horizontal, 12px gap):
    - Category icon (32x32px, orange bg, 8px radius) OR emoji fallback
    - Category name (Body/Regular-Medium, gray-900, flex-grow)
    - "Earn 1.30× SP" badge (orange-50 bg, orange-600 text, Body/Small, pill shape)
    - ⭐ or 🏆 bonus badge (right, conditional: ⭐ standard bonus, 🏆 premium bonus)

---

COMPONENT: SPCalculatorWidget
Frame: white bg, gray-100 border (1px), 12px radius, 16px padding
Modes: free (HelpScreen — empty state, both editable), auto (ItemCreateScreen — pre-fills category)

Calculator Layout (auto-layout vertical, 12px gap):

Input Row 1 — Category:
- Label (Body/Small, gray-600): "Item Category"
- Category picker button (full-width, gray-50 bg, gray-300 border, 12px radius, 14px padding):
  - Left: category icon (24px) OR "Select a category" (gray-400 placeholder)
  - Right: chevron-down icon (16px, gray-600)
  - Opens: CategoryPicker modal (reuse from FLOW-04)

Input Row 2 — Price:
- Label (Body/Small, gray-600): "Item Price"
- Text input (full-width, design-system.md Form/Input):
  - Prefix "$" (Body/Regular, gray-600)
  - Placeholder: "0.00"
  - Range: $0 - $10,000, 2 decimal precision

Calculate Button:
- "Calculate SP" (Button/Primary/Medium, full-width, orange)

Results Panel — Sell Mode (below button, visible after calculation):
- Green-50 bg, green-200 border-left (4px), 12px radius, 12px padding
- "If You Sell This Item" (Body/Small-Medium, green-800)
- SP earned (Heading/H3, green-700): "+250 SP earned"
- Cash equivalent (Body/Small, gray-600): "~$2.50 value"
- Bonus badge (if category has multiplier > 1.10): ⭐ "Bonus category! 1.30× rate"

Results Panel — Buy Mode (adjacent or below Sell):
- Teal-50 bg, teal-200 border-left (4px), 12px radius, 12px padding
- "If You Buy This Item" (Body/Small-Medium, teal-800)
- Max SP you can spend (Heading/H3, teal-700): "Up to 150 SP"
- Cash savings (Body/Small, gray-600): "Save up to $1.50"
- Cap note (Body/Small, gray-500): "Based on your membership tier (30-70% max)"

NAVIGATION FLOW:
- Signup complete → OnboardingCarousel → Home
- Settings → Help → How Trading Works → Accordion sections
- ItemCreateScreen → SP Calculator (auto mode, pre-fills category)
- HelpScreen → SP Calculator (free mode) → Bonus Categories

FIGMA-SPECIFIC REQUIREMENTS:

- AI Empowerment: Treat these requirements as a starting point. Please provide suggestions for UI/UX improvements, alternative screen layouts, or propose new screens if they create a more ideal user experience.
- AI Collaboration: Please ask clarification questions or push back on any requirements that do not make structural or UX sense.
- Dependencies: Call out any design or flow dependencies you encounter while reading the prompts.
- Recommendations: For any questions or pushback, please provide your specific recommendations for how to proceed.

- Prototype Configuration: Use "Smart Animate" for transitions (300ms ease-in-out)
- Prototype Configuration: Configure overflow scrolling for long content areas
- Prototype Configuration: Add bottom tab bar navigation to all applicable screens
- Prototype Configuration: Link all modal overlays to dismiss on background tap
- Prototype Configuration: Configure keyboard navigation for form flows
- Accordion expand/collapse animation (chevron rotation, height transition)
- SPCalculatorWidget as reusable component (free + auto modes as variants)
- Bonus category badge component (⭐/🏆 variants)
- Illustrated slides for onboarding carousel (4 illustrations)
- Deep link prototype: ?section param auto-expands correct accordion
- SP Calculator: live update on Calculate tap (not real-time slider)
- Dual result panels visible simultaneously (sell + buy side by side on larger screens)
- Interactive prototype: onboarding flow complete → lands on Discover

---
FIELD INVENTORY — FLOW-19 Education Screens:

--- OnboardingEducationCarousel ---
INPUT FIELDS (user-editable):
- "Skip" link (top-right): dismisses carousel, marks onboarding_completed_at, navigates to DiscoverScreen
- "Next" button: advances to next slide
- "Get Started" button (last slide, replaces Next): marks onboarding_completed_at, navigates to DiscoverScreen
- Swipe left/right gesture: advances or goes back between slides

DISPLAY FIELDS (read-only):
- Slide 1: Welcome illustration + "Pass It Up" wordmark + tagline (static)
- Slide 2: SP illustration + "Earn Swap Points" + SP example pill (dynamic: SP reward % and cash equivalent from admin config)
- Slide 3: Safety illustration + "Trade Safely" + safety tip pill (static)
- Slide 4: Sustainability illustration + "Good for Kids, Good for the Planet" + eco-stats row (static)
- Dot progress indicator: active slide = orange filled, inactive = gray-200 (dynamic per slide)

AUTO-CALCULATED:
- Shown only when profiles.onboarding_completed_at IS NULL
- Sets profiles.onboarding_completed_at on "Get Started" or "Skip"

--- HelpScreen ---
INPUT FIELDS (user-editable):
- Accordion section tap: expands/collapses section (chevron rotates 180°)
- SPCalculatorWidget — Category picker: opens CategoryPicker modal (hierarchical, from FLOW-04)
- SPCalculatorWidget — Price input: numeric text input, $0–$10,000
- SPCalculatorWidget — "Calculate SP" button: triggers SP calculation and renders results panels
- Pull-to-refresh: reloads DB-managed accordion content

DISPLAY FIELDS (read-only):
- 4 accordion sections (DB-configurable): "What are Swap Points?", "How do I earn SP?", "How do I spend SP?", "Trading Safety Tips" (dynamic from DB)
- SPCalculatorWidget results (see below)
- Bonus SP Categories list: category name, icon/emoji, earning multiplier badge ⭐/🏆 (dynamic from admin config)

AUTO-CALCULATED:
- Accordion content from help_content table (admin-managed)
- Bonus category multipliers from category_sp_multipliers admin config table

--- SPCalculatorWidget ---
INPUT FIELDS (user-editable):
- Category picker button: opens CategoryPicker modal
- Price text input: numeric, $0.00–$10,000, 2-decimal precision
- "Calculate SP" button: computes results for entered category + price

DISPLAY FIELDS (read-only):
- Category placeholder / selected category icon + name (dynamic)
- Sell Results panel (green-50 bg, conditional — shown after Calculate): "+X SP earned" + "~$X.XX value" + bonus badge if multiplier >1.10 (dynamic)
- Buy Results panel (teal-50 bg, conditional — shown after Calculate): "Up to X SP spendable" + "Save up to $X.XX" + spend cap note "X–X%" (dynamic)

AUTO-CALCULATED:
- SP earn = price × base_rate × category_multiplier (from admin config)
- SP spend max = price × admin-configured spend cap %
---
```

---

## FLOW-21: ID Verification — Mobile Upload & Status

**Priority**: P0 (Critical) — Trust & Safety, Verified badge system

```
Design the ID verification mobile screens. Reference app-overview.md (user trust, Verified badge), design-system.md, and screen-flow-mapping.md FLOW-21. Backend complete (BADGE-009, BADGE-013). Design only customer-facing mobile screens.

SCREENS TO DESIGN (2 total):
1. IDVerificationUploadScreen
2. IDVerificationStatusScreen (shown via ProfileScreen status section)

Use design-system.md components, privacy-first tone, reassuring copy.

---

SCREEN 1: IDVerificationUploadScreen
Frame: 375x812px, white background
Navigation: ProfileScreen → "Upgrade to Verified" CTA → IDVerificationUploadScreen

Header:
- Back button (top-left, 44x44px)
- "Verify Your Identity" (Heading/H2, gray-900, centered)

Progress Indicator (16px below header):
- 3-step: "Upload" (active, orange) → "Review" → "Decision"
- Step dots (24px, active=orange filled, future=gray-200)

Trust Banner (16px below progress):
- Teal-50 bg, teal-600 border-left (4px), 12px padding, 16px horizontal
- Shield icon (20px, teal-700) + "Privacy Protected" (Body/Regular-Medium, teal-900)
- Sub-text (Body/Small, teal-800): "Your ID is deleted immediately after review — never stored"

Disclaimer Section (16px below banner):
- Card (gray-50 bg, gray-200 border, 12px radius, 16px padding):
  - "Before You Submit" (Body/Regular-Medium, gray-900)
  - Disclaimer text (Body/Small, gray-700, DB-configurable from `id_badge_verification_messages`):
    - "We'll review your government-issued ID to verify your identity"
    - "Accepted: Driver's license, passport, state ID"
    - "Your submission will be reviewed within 24 hours"
  - "Why do we need this?" link (Body/Small, orange, underline) → Info Modal

Info Modal (full-overlay):
- "Why Verify Your Identity?" (Heading/H2)
- Benefits list (auto-layout vertical, 8px gap):
  - ✓ Verified badge on your profile
  - ✓ Build buyer/seller trust
  - ✓ Access to higher transaction limits
  - ✓ Faster dispute resolution
- Privacy section (teal-50 bg, 12px radius, 12px padding):
  - Shield icon + "Your ID is deleted immediately after admin review. We never store it."
- "Got It" (Button/Primary/Large)

Upload Area (16px below disclaimer):
- Large dashed upload zone (full-width minus 32px, 200px height, gray-200 border dashed 2px, 12px radius):
  - Camera icon (64px, gray-400, centered) if empty
  - "Take Photo or Upload from Gallery" (Body/Regular, gray-600, centered, 8px below icon)
  - "Max 10MB, JPG or PNG" (Body/Small, gray-400, centered)

Upload Buttons (auto-layout horizontal, 16px gap, 16px below upload zone):
- "Take Photo" (Button/Secondary/Medium, flex-grow, camera icon left)
- "Choose from Gallery" (Button/Secondary/Medium, flex-grow, image icon left)

Photo Preview (replaces upload zone after selection):
- Image preview (full-width minus 32px, 200px height, 12px radius, object-fit: cover)
- "Remove" link (Body/Small, red-600, top-right corner of image, 8px padding)
- "Retake" link (Body/Small, orange, centered, 8px below image)

Upload Quality Tips (16px below upload area):
- "For best results:" (Body/Small-Medium, gray-700)
- Tips list (auto-layout vertical, 4px gap, Body/Small, gray-600):
  - ✓ Ensure all text is clearly visible
  - ✓ Use good lighting, avoid glare
  - ✓ Full document in frame, no cropping
  - ✓ Only submit your own ID

Submit Button (fixed to bottom, white bg, shadow):
- "Submit for Verification" (Button/Primary/Large, full-width, 16px padding)
- Disabled state: gray, "Please upload a photo to continue"
- Loading state: spinner, "Submitting..."

Duplicate Prevention Banner (if pending request exists):
- Orange-50 bg, orange-600 border-left (4px), 12px padding
- Clock icon + "Verification Pending" (Body/Regular-Medium, orange-900)
- Sub-text: "Your submission is under review. We'll notify you within 24 hours."
- Replaces submit button with: "View Status" (Button/Secondary/Medium)

---

SCREEN 2: IDVerificationStatusScreen
Context: Integrated into ProfileScreen as a status section (not a standalone screen)
Access: ProfileScreen → Identity Verification section

Status Card (ProfileScreen → below profile avatar/info, 16px padding):
Card (white bg, gray-200 border, 12px radius, 16px padding):

State 1 — Not Started:
- Icon (32px, gray-400): ID card outline
- "Get Verified" (Body/Regular-Medium, gray-900)
- Sub-text (Body/Small, gray-600): "Add a Verified badge to build trust with buyers and sellers"
- "Start Verification" button (Button/Primary/Medium, full-width)

State 2 — Pending Review:
- Icon (32px, yellow-600): Clock with checkmark
- "Verification Pending" (Body/Regular-Medium, yellow-900)
- Sub-text (Body/Small, gray-600): "Under review. We'll notify you within 24 hours."
- Progress indicator: 3-step (Upload ✓ → Review (active, pulsing) → Decision)

State 3 — Approved:
- Icon (32px, green-600): Checkmark circle (verified badge)
- "Identity Verified ✓" (Body/Regular-Medium, green-800)
- Verified badge preview (orange + star, compact, inline)
- "Verified on [Date]" (Body/Small, gray-600)
- Celebration animation: subtle confetti or shimmer on first view

State 4 — Rejected:
- Icon (32px, red-600): Alert circle
- "Verification Unsuccessful" (Body/Regular-Medium, red-800)
- Rejection reason (Body/Small, red-700): e.g., "Reason: Unclear photo"
- Admin notes if present (Body/Small, gray-600, italic): "Please retake with better lighting"
- "Resubmit Verification" button (Button/Primary/Medium, full-width)
- "Contact Support" link (Body/Small, gray-600, centered)

NAVIGATION FLOW:
- ProfileScreen → Identity Verification section → "Start Verification" → IDVerificationUploadScreen
- IDVerificationUploadScreen → Submit → back to ProfileScreen (pending state)
- Notification tap (approved/rejected) → ProfileScreen scrolls to ID Verification section

FIGMA-SPECIFIC REQUIREMENTS:

- AI Empowerment: Treat these requirements as a starting point. Please provide suggestions for UI/UX improvements, alternative screen layouts, or propose new screens if they create a more ideal user experience.
- AI Collaboration: Please ask clarification questions or push back on any requirements that do not make structural or UX sense.
- Dependencies: Call out any design or flow dependencies you encounter while reading the prompts.
- Recommendations: For any questions or pushback, please provide your specific recommendations for how to proceed.

- Prototype Configuration: Use "Smart Animate" for transitions (300ms ease-in-out)
- Prototype Configuration: Configure overflow scrolling for long content areas
- Prototype Configuration: Add bottom tab bar navigation to all applicable screens
- Prototype Configuration: Link all modal overlays to dismiss on background tap
- Prototype Configuration: Configure keyboard navigation for form flows
- 4 status card state variants (not started / pending / approved / rejected)
- Upload zone with 3 states (empty, selected/preview, duplicate-blocked)
- Discrete upload progress states (not progress bar — step-by-step)
- Info modal with privacy focus
- Confetti/celebration frame for approved state (one-time animation)
- Disable duplicate submission: overlay "Verification Pending" on upload zone
- Create ID card placeholder graphic (generic, no real ID data)

---
FIELD INVENTORY — IDVerificationUploadScreen:

INPUT FIELDS (user-editable):
- "Take Photo" button: opens camera to capture government-issued ID
- "Choose from Gallery" button: opens photo library to select ID image
- "Remove" link (photo preview): clears selected photo, returns to empty upload zone
- "Retake" link (photo preview): re-opens camera or gallery picker
- "Why do we need this?" link: opens Info Modal
- "Got It" button (Info Modal): closes modal
- "Submit for Verification" button: uploads photo + creates verification_requests record (disabled until photo selected)

DISPLAY FIELDS (read-only):
- 3-step progress indicator: Upload (active, orange) → Review → Decision (dynamic — shows Upload as current step)
- Privacy protected trust banner (teal-50 bg): "Your ID is deleted immediately after review — never stored" (static)
- Disclaimer card (gray-50 bg): accepted ID types, review timeline, configurable text from id_badge_verification_messages (dynamic from DB)
- Upload zone empty state: camera icon + instructions (static)
- Photo preview (conditional): full image fill + Remove/Retake links (shown after photo selected)
- Upload quality tips: 4 tips for clear photo capture (static)
- Duplicate prevention banner (conditional, orange-50 bg): "Verification Pending" + "View Status" button (replaces Submit when pending request already exists)

AUTO-CALCULATED:
- getIDVerificationStatus() to check for existing pending request
- createIDVerificationRequest() on Submit

---
FIELD INVENTORY — IDVerificationStatusScreen (ProfileScreen embedded card):

INPUT FIELDS (user-editable):
- "Start Verification" button (State 1 — Not Started): navigates to IDVerificationUploadScreen
- "Resubmit Verification" button (State 4 — Rejected): navigates to IDVerificationUploadScreen
- "Contact Support" link (State 4 — Rejected): navigates to ContactSupportScreen

DISPLAY FIELDS (read-only):
- State 1 (Not Started): gray ID icon + "Get Verified" + description + "Start Verification" CTA (static)
- State 2 (Pending Review): yellow clock icon + "Verification Pending" + 3-step progress bar (Upload ✓, Review active/pulsing, Decision pending) (dynamic)
- State 3 (Approved): green checkmark icon + "Identity Verified ✓" + verified badge preview (orange + star) + "Verified on [date]" + one-time confetti/shimmer animation (dynamic)
- State 4 (Rejected): red alert circle icon + "Verification Unsuccessful" + rejection reason + admin notes in italic (dynamic from verification_requests)

AUTO-CALCULATED:
- getIDVerificationStatus() RPC: returns status (not_started / pending / approved / rejected)
- rejection_reason + admin_notes from verification_requests table
---
```

---

## FLOW-22: Seller Earnings & Payouts

**Priority**: P1 (High) — Seller monetization, trust, and payout management

```
Design the seller earnings and payout management screens. Reference app-overview.md (seller business model, Stripe Connect), design-system.md, and screen-flow-mapping.md FLOW-22. Existing screens: SellerEarningsScreen.tsx + PayoutSettingsScreen.tsx.

SCREENS TO DESIGN (2 total):
1. SellerEarningsScreen (balance dashboard + payout history)
2. PayoutSettingsScreen (payout methods + withdrawal initiation)

Use design-system.md components, financial clarity, trust-building design.

---

SCREEN 1: SellerEarningsScreen
Frame: 375x812px, white background
Navigation: Profile → "Seller Earnings" OR UserDashboard → "Payouts"

Header:
- Back button (top-left)
- "Seller Earnings" (Heading/H2, gray-900, centered)
- "Payout Settings" link (top-right, Body/Small, orange): navigates to PayoutSettingsScreen

Earnings Summary Hero Card (16px padding):
- Card (teal-to-green gradient, 45deg, 16px radius, 24px padding, shadow):
  - "Available to Withdraw" (Body/Small, white/80%, centered)
  - Amount (Heading/Display-1, white, centered, bold): "$47.50"
  - "Withdraw Funds" button (Button/Secondary/Medium, white border, white text, centered, 16px below)

Earnings Breakdown Row (16px below hero card, auto-layout horizontal, 12px gap):
- 3 mini cards (flex-grow, equal width, white bg, gray-200 border, 10px radius, 12px padding):
  - Card 1 — Pending:
    - "Pending" (Body/Small, gray-500, centered)
    - "$12.00" (Heading/H3, yellow-700, centered)
    - Sub-text (Body/Small, gray-400, centered): "In-progress trades"
  - Card 2 — Lifetime:
    - "Lifetime" (Body/Small, gray-500, centered)
    - "$284.50" (Heading/H3, gray-900, centered)
    - Sub-text (Body/Small, gray-400, centered): "Total earned"
  - Card 3 — Last Payout:
    - "Last Payout" (Body/Small, gray-500, centered)
    - "$35.00" (Heading/H3, teal-700, centered)
    - Sub-text (Body/Small, gray-400, centered): "Mar 15, 2026"

Payout Method Banner (16px below breakdown, if no method set):
- Orange-50 bg, orange-600 border-left (4px), 12px padding
- Alert icon + "No Payout Method Set" (Body/Regular-Medium, orange-900)
- Sub-text (Body/Small, orange-800): "Add Stripe, PayPal, or Venmo to withdraw funds"
- "Add Payout Method" button (Button/Primary/Small, inline right)

Payout History Section (16px below banner):
- "Payout History" (Heading/H3, gray-900) + filter button (gray-600, "All Statuses" chevron-down)
- Filter options: All / Completed / Processing / Failed

Payout History List (auto-layout vertical, 12px gap, scrollable):

Payout Card Component (reusable):
- White bg, gray-200 border (1px), 12px radius, 16px padding
- Auto-layout horizontal, space-between:
  - Left section (auto-layout vertical, 4px gap):
    - Provider badge (12px radius, 6px padding, 10px font):
      - Stripe: blue-600 bg, white text
      - PayPal: yellow-500 bg, gray-900 text
      - Bank: green-600 bg, white text
    - Date (Body/Small, gray-600): "Mar 15, 2026"
    - Reference (Body/Small, gray-400, monospace, Fira Code): "PAY-2803"
  - Right section (auto-layout vertical, 4px gap, align-right):
    - Amount (Heading/H3, green-700): "$35.00"
    - Status badge (pill):
      - Completed: green-100 bg, green-800 text
      - Processing: yellow-100 bg, yellow-800 text
      - Failed: red-100 bg, red-800 text
      - Pending: gray-100 bg, gray-700 text

Empty State (no payouts yet):
- Wallet illustration (160x160px, gray-300 tone)
- "No payouts yet" (Heading/H3, gray-700, centered)
- "Complete your first sale to earn money" (Body/Regular, gray-600, centered)
- "Browse Listings" button (Button/Secondary/Large, centered)

---
FIELD INVENTORY — SellerEarningsScreen:

INPUT FIELDS (user-editable):
- "Withdraw Funds" button (hero card): opens Withdrawal Modal (bottom-sheet)
- Withdrawal Modal — amount input: numeric, pre-filled with available balance, max = available balance
- Withdrawal Modal — payout method selector: dropdown, shows configured methods
- Withdrawal Modal — "Confirm Withdrawal" button: initiates payout (disabled until amount > 0 and method selected)
- "Payout Settings" link (header top-right): navigates to PayoutSettingsScreen
- "Add Payout Method" button (no-method banner): navigates to PayoutSettingsScreen
- Payout history filter: opens filter sheet (All / Completed / Processing / Failed)
- Payout card tap: navigates to payout detail (if implemented)
- "Browse Listings" button (empty state): navigates to DiscoverScreen
- Pull-to-refresh: reloads balance + payout history

DISPLAY FIELDS (read-only):
- Earnings hero card (teal-to-green gradient): available balance + "Withdraw Funds" CTA (dynamic from seller_balances)
- 3 mini breakdown cards: Pending (yellow-700) / Lifetime (gray-900) / Last Payout (teal-700) (dynamic)
- No Payout Method banner (conditional, orange-50 bg): shown when no method is configured (dynamic)
- Payout history list: provider badge (Stripe/PayPal/Bank with brand colors), date, Fira Code reference ID, amount, status pill (dynamic from DB)
- Empty state (conditional): wallet illustration + "No payouts yet" (shown if history is empty)

AUTO-CALCULATED:
- Available balance from seller_balances.available_amount
- Pending balance from in-flight trades not yet settled
- Lifetime total = SUM of completed payouts
- getPayoutHistory() filtered by selected status
---

SCREEN 2: PayoutSettingsScreen
Frame: 375x812px, white background
Navigation: SellerEarningsScreen → "Payout Settings" OR Profile → Settings → Payouts

Header:
- Back button (top-left)
- "Payout Settings" (Heading/H2, gray-900, centered)

Eligibility Banner (conditional):
- If eligible: teal-50 bg, teal-600 border-left (4px), checkmark icon, "You are eligible to receive payouts"
- If not eligible: orange-50 bg, orange-600 border-left (4px), alert icon, reason text (e.g., "Complete your profile to receive payouts")

Balance Section (16px padding):
- Card (gray-50 bg, gray-200 border, 12px radius, 16px padding):
  - "Available to Withdraw" (Body/Small, gray-600)
  - "$47.50" (Heading/H2, teal-700)
  - "Withdraw All" link (Body/Small, orange, right)

Withdrawal Modal (triggered by "Withdraw Funds" or "Withdraw All"):
- Bottom-sheet style, 24px top radius
- "Withdraw Funds" (Heading/H3, gray-900, centered, handle bar above)
- Amount input (large text input, centered, "$" prefix):
  - Placeholder: "0.00"
  - "Available: $47.50" (Body/Small, gray-600, right)
- Payout method selector (dropdown, shows default method)
- Fee note (Body/Small, gray-500, centered): "Transfers typically arrive in 2-5 business days"
- "Confirm Withdrawal" button (Button/Primary/Large, full-width)
- "Cancel" link (Body/Small, gray-600, centered)

Payout Methods Section (16px below balance):
- "Payout Methods" (Heading/H3, gray-900) + "Add Method" link (Body/Small, orange, right)

Payout Method Card Component (reusable):
- White bg, gray-200 border (1px), 12px radius, 16px padding
- Auto-layout horizontal, space-between:
  - Left: Provider logo/icon (40x40px, 10px radius) + method details:
    - Provider name (Body/Regular-Medium, gray-900): "Stripe Connect" / "PayPal" / "Venmo"
    - Status (Body/Small, green-700 if verified, yellow-700 if unverified): "Verified ✓" / "Pending Verification"
    - Detail (Body/Small, gray-600): "sarah@email.com" OR "Bank ending in 4242"
  - Right: Default badge (teal-100 bg, teal-700 text, "Default", if primary) + 3-dot menu icon

3-dot Menu Options (action sheet):
- "Set as Default" (if not already default)
- "Remove Method" (red text)

Add Method Options (action sheet or new screen):
- "Connect Stripe" (preferred, bank transfer): Opens Stripe Connect onboarding (external web view)
  - Stripe onboarding banner (teal-50 bg, 12px radius, 12px padding):
    - Stripe logo + "Connect with Stripe for fastest payouts"
    - "Start Onboarding" button → opens Stripe Connect URL
    - Onboarding status: "Pending" → "Onboarding Complete" → "Payouts Enabled" (3-step status)
- "Add PayPal" (email input, 12px radius card):
  - PayPal email input (design-system.md Form/Input)
  - "Save PayPal" button
- "Add Venmo" (handle input, 12px radius card):
  - Venmo handle input ("@username")
  - "Save Venmo" button

Verification Pending Notice (FLOW-23 — integrated):
- If method unverified (micro-deposit pending):
  - Yellow-50 bg, yellow-600 border-left (4px), 12px padding
  - Clock icon + "Verification Pending" (Body/Regular-Medium, yellow-900)
  - "Check your bank account for 2 small deposits (under $1.00). Enter amounts to verify."
  - Two amount inputs (Body/Regular, inline): "$0.__ and $0.__"
  - "Verify Deposits" button (Button/Primary/Medium)

---
FIELD INVENTORY — PayoutSettingsScreen:

INPUT FIELDS (user-editable):
- "Withdraw All" link (Balance Section): pre-fills withdrawal amount = available balance in Withdrawal Modal
- Withdrawal Modal — amount text input: numeric, max = available balance
- Withdrawal Modal — payout method selector: dropdown, lists configured methods
- Withdrawal Modal — "Confirm Withdrawal" button: initiates payout (disabled until amount > $0)
- "Add Method" link (Payout Methods header): opens Add Method action sheet
- Add Method — "Connect Stripe" option: opens Stripe Connect onboarding (external web view)
- Add Method — "Add PayPal" option: shows PayPal email input + Save button
- Add Method — "Add Venmo" option: shows Venmo @handle input + Save button
- Per-method 3-dot menu: "Set as Default" / "Remove Method"
- Micro-deposit verification — two amount inputs + "Verify Deposits" button (conditional, when method.status = pending_micro_deposit)

DISPLAY FIELDS (read-only):
- Eligibility banner: teal-50 (eligible, checkmark) or orange-50 (not eligible, reason) (dynamic from getPayoutEligibility())
- Available balance card: "$47.50" + "Withdraw All" link (dynamic from seller_balances)
- Payout method cards: provider logo, name, status badge (Verified ✓ green / Pending Verification yellow), detail text, Default pill (teal) (dynamic from DB)
- Stripe Connect onboarding status (conditional): Pending / Onboarding Complete / Payouts Enabled (3-step inline states) (dynamic)
- Micro-deposit notice (conditional, yellow-50 bg): shown when method awaiting verification (dynamic)

AUTO-CALCULATED:
- Payout eligibility from getPayoutEligibility() RPC
- Stripe Connect onboarding URL from createStripeConnectLink() RPC
- Micro-deposit verification via verifyMicroDeposits(amount1, amount2) RPC
---

NAVIGATION FLOW:
- Profile → Seller Earnings → available balance → withdraw
- Seller Earnings → Payout Settings → Add Stripe → Stripe onboarding → return verified
- Payout Settings → Add PayPal → enter email → saved → set as default
- Trade completed → seller balance increases → available for withdrawal

FIGMA-SPECIFIC REQUIREMENTS:

- AI Empowerment: Treat these requirements as a starting point. Please provide suggestions for UI/UX improvements, alternative screen layouts, or propose new screens if they create a more ideal user experience.
- AI Collaboration: Please ask clarification questions or push back on any requirements that do not make structural or UX sense.
- Dependencies: Call out any design or flow dependencies you encounter while reading the prompts.
- Recommendations: For any questions or pushback, please provide your specific recommendations for how to proceed.

- Prototype Configuration: Use "Smart Animate" for transitions (300ms ease-in-out)
- Prototype Configuration: Configure overflow scrolling for long content areas
- Prototype Configuration: Add bottom tab bar navigation to all applicable screens
- Prototype Configuration: Link all modal overlays to dismiss on background tap
- Prototype Configuration: Configure keyboard navigation for form flows
- Payout card variants: Stripe, PayPal, Venmo (different brand colors/logos)
- Payout status badge variants (completed/processing/pending/failed)
- Withdrawal modal as bottom-sheet component
- Stripe Connect onboarding states (pending/in-progress/complete/payouts-enabled)
- Provider verification states (unverified/micro-deposit-pending/verified)
- Empty state for no payout methods added
- Interactive prototype: add method → verify → withdraw → success state
- Balance cards with gradient hero (teal-to-green, mirrors SP Wallet style)
```

---

## FLOW-24: MFA / Multi-Factor Authentication Enrollment

**Priority**: P1 (High) — Account security for sellers and high-value users

```
Design MFA enrollment screens. Reference app-overview.md (account security), design-system.md, and screen-flow-mapping.md FLOW-24. Backend complete (Supabase Auth MFA built-in).

SCREENS TO DESIGN (3 total + 1 modal):
1. MFAEnrollmentScreen (Settings → Security → Two-Factor Authentication)
2. TOTPSetupScreen (Authenticator app setup)
3. SMSSetupScreen (SMS code setup)
4. MFAVerificationModal (inline modal for sensitive action gates)

Use design-system.md components, security-first design, clear step-by-step flow.

---

SCREEN 1: MFAEnrollmentScreen
Frame: 375x812px, white background
Navigation: Settings → "Security" → "Two-Factor Authentication"

Header:
- Back button (top-left)
- "Two-Factor Authentication" (Heading/H2, gray-900, centered)

Status Banner (16px padding):
- If no MFA enabled: orange-50 bg, orange-600 border-left (4px):
  - Alert icon + "Your account has no extra security" (Body/Regular-Medium, orange-900)
  - Sub-text: "Add two-factor authentication to protect your account"
- If MFA enabled: green-50 bg, green-600 border-left (4px):
  - Checkmark icon + "Two-factor authentication is ON" (Body/Regular-Medium, green-900)
  - Sub-text: "Your account is protected with an additional verification step"

Authentication Methods Section (16px below banner):
- "Authentication Methods" (Heading/H3, gray-900, 16px padding)

Method Card — Authenticator App:
- White bg, gray-200 border, 12px radius, 16px padding
- Auto-layout horizontal, 12px gap:
  - Icon (40x40px, teal-100 bg, 10px radius): phone with lock
  - Content (flex-grow, auto-layout vertical, 4px gap):
    - "Authenticator App" (Body/Regular-Medium, gray-900)
    - "Use Google Authenticator, Authy, or 1Password" (Body/Small, gray-600)
    - Status pill (green if verified, gray if not set): "Verified ✓" OR "Not Set"
  - Action (Button/Secondary/Small): "Set Up" OR "Remove"

Method Card — SMS:
- Same structure as Authenticator App card
- Icon: message bubble with lock
- "SMS Text Message" (Body/Regular-Medium)
- "Receive a 6-digit code via text message" (Body/Small, gray-600)
- "Set Up" OR "Verified ✓ +1 (555) 123-4567" + "Remove"

Recovery Codes Section (16px below methods, only if MFA enabled):
- Card (yellow-50 bg, yellow-200 border, 12px radius, 16px padding):
  - Key icon (24px, yellow-700) + "Backup Recovery Codes" (Body/Regular-Medium, yellow-900)
  - Sub-text: "Save these codes in case you lose access to your authenticator"
  - "View Recovery Codes" button (Button/Secondary/Medium)
  - "Regenerate Codes" link (Body/Small, red-600, 8px below)

---
FIELD INVENTORY — MFAEnrollmentScreen:

INPUT FIELDS (user-editable):
- Authenticator App "Set Up" button: navigates to TOTPSetupScreen
- SMS "Set Up" button: navigates to SMSSetupScreen
- "View Recovery Codes" button (recovery section, shown if MFA enabled): displays backup codes modal
- "Regenerate Codes" link: generates new recovery codes, invalidates old ones (requires confirmation)
- Enable MFA toggle (if off): initiates setup via method selection
- Remove MFA method button (3-dot or Remove link per method): removes the configured factor

DISPLAY FIELDS (read-only):
- MFA status header banner: green-50 "MFA Enabled" or gray-50 "MFA Not Enabled" (dynamic)
- Authenticator App method card: shows "Set Up" button (not configured) OR "Verified ✓ [app name]" + Remove (configured) (dynamic)
- SMS method card: shows "Set Up" button (not configured) OR "Verified ✓ +1 (555) 123-4567" + Remove (configured) (dynamic)
- Recovery Codes section (conditional, yellow-50 bg): only shown when MFA is enabled (dynamic)

AUTO-CALCULATED:
- MFA enrollment status from supabase.auth.mfa.listFactors() 
- Recovery code count from mfa_recovery_codes table
---

SCREEN 2: TOTPSetupScreen
Frame: 375x812px, white background
Navigation: MFAEnrollmentScreen → "Set Up" (Authenticator App)

Header:
- Back button (top-left)
- "Set Up Authenticator" (Heading/H2, gray-900, centered)

Steps Progress (2-step: Scan → Verify):
- Step indicator (same style as FLOW-04 stepper)

Step 1 — Scan QR Code:
- Instruction card (gray-50 bg, 12px radius, 16px padding):
  - "Step 1: Scan QR Code" (Body/Regular-Medium, gray-900)
  - Instructions (Body/Small, gray-700):
    - 1. Open your authenticator app (Google Authenticator, Authy, etc.)
    - 2. Tap "+" or "Add Account"
    - 3. Scan the QR code below
- QR Code (200x200px, centered, white bg, 8px padding, gray-200 border, 12px radius)
- "Can't scan?" link (Body/Small, orange, centered, 12px below QR)
- Manual entry section (if "Can't scan?" tapped, collapsible):
  - "Setup Key" label (Body/Small, gray-600)
  - Key value (Fira Code, gray-900, gray-100 bg, 12px radius, 12px padding, selectable): "JBSWY3DPEHPK3PXP"
  - Copy button (icon, right)
- "Next: Verify Code" button (Button/Primary/Large, full-width, 16px below)

Step 2 — Verify Code:
- "Step 2: Enter Verification Code" (Body/Regular-Medium, gray-900)
- Sub-text: "Enter the 6-digit code shown in your authenticator app"
- OTP Input (6 large digit boxes, auto-advance, design-system.md):
  - Each box: 48x56px, gray-200 border, 12px radius, Heading/H2 font
  - Active box: orange-600 border (2px)
- Error state: boxes turn red, "Incorrect code. Try again." (red-600, centered)
- "Verify & Enable" button (Button/Primary/Large, full-width, disabled until 6 digits entered)

Backup Codes Screen (after successful TOTP setup):
- Full-screen overlay (not dismissible until saved)
- "Save Your Recovery Codes" (Heading/H2, gray-900, centered)
- Warning banner (orange-50 bg): "Save these now — you won't see them again"
- Codes grid (2 columns, 5 rows = 10 codes):
  - Each code: Fira Code, gray-900, gray-100 bg, 8px radius, 8px padding, centered
  - Example: "ABCD-EFGH-1234"
- Action buttons (auto-layout vertical, 12px gap):
  - "Copy All Codes" (Button/Secondary/Large)
  - "Download as PDF" (Button/Tertiary/Large)
- Confirmation checkbox: "I have saved my recovery codes"
- "Done" button (Button/Primary/Large, disabled until checkbox checked)

---
FIELD INVENTORY — TOTPSetupScreen:

INPUT FIELDS (user-editable):
- Step 1 — "Copy Secret" link: copies TOTP secret key to clipboard
- Step 1 — OTP app deep-link button ("Open in Authenticator"): pre-fills secret in app
- Step 2 — OTP 6-box input: user enters TOTP code from authenticator app
- Step 2 — "Verify & Enable" button: verifies code + enables TOTP factor (disabled until 6 digits entered)
- Backup codes screen — "Copy All Codes" button: copies all 10 codes to clipboard
- Backup codes screen — "Download as PDF" button: generates + downloads PDF
- Backup codes screen — Confirmation checkbox: "I have saved my recovery codes"
- Backup codes screen — "Done" button: completes TOTP setup (disabled until checkbox checked)

DISPLAY FIELDS (read-only):
- 2-step progress indicator: Scan → Verify (dynamic, active step highlighted)
- Step 1: QR code (200×200px, auto-generated by Supabase Auth MFA) + plain-text secret key (monospace) (dynamic)
- App suggestions: Google Authenticator, Authy, 1Password icons + names (static)
- Step 2: "Enter the 6-digit code" prompt + OTP boxes with active/filled/error states (dynamic)
- Error state (conditional): red border + error message if code invalid
- Backup codes overlay (full-screen, not dismissible): 10 codes in 2-column grid (Fira Code), warning banner (dynamic from supabase.auth.mfa)

AUTO-CALCULATED:
- QR code content + secret from supabase.auth.mfa.enroll({ factorType: 'totp' })
- Code verification via supabase.auth.mfa.challengeAndVerify()
---

SCREEN 3: SMSSetupScreen
Frame: 375x812px, white background
Navigation: MFAEnrollmentScreen → "Set Up" (SMS)

Header:
- Back button (top-left)
- "Set Up SMS Authentication" (Heading/H2, gray-900, centered)

Steps Progress (2-step: Phone → Verify):

Step 1 — Enter Phone:
- "Your Phone Number" (Body/Regular-Medium, gray-900)
- Sub-text: "We'll send a 6-digit code to verify your number"
- Phone input (design-system.md Form/Input, country flag + code prefix):
  - Country code selector (+1 US)
  - Phone number field
- "Send Verification Code" (Button/Primary/Large, full-width)

Step 2 — Verify Code (same OTP input as TOTP step 2):
- "Enter the 6-digit code sent to [phone]" (Body/Regular, gray-700, centered)
- OTP input boxes (same design as TOTP)
- "Resend Code" link (Body/Small, orange, centered, 12px below): active after 60s cooldown
- Countdown: "Resend in 54s" (gray-400, if cooldown active)
- "Verify & Enable" button (Button/Primary/Large)

---
FIELD INVENTORY — SMSSetupScreen:

INPUT FIELDS (user-editable):
- Step 1 — Country code selector: selects country + dialing code (e.g., +1 US)
- Step 1 — Phone number text input: numeric, formatted for selected country
- Step 1 — "Send Verification Code" button: sends SMS OTP (disabled until valid phone number entered)
- Step 2 — OTP 6-box input: enters the SMS code received
- Step 2 — "Resend Code" link: resends SMS (enabled after 60s cooldown; shows countdown while cooling)
- Step 2 — "Verify & Enable" button: verifies code + enables SMS MFA factor (disabled until 6 digits)

DISPLAY FIELDS (read-only):
- 2-step progress indicator: Phone → Verify (dynamic)
- Step 2 context: "Code sent to [phone number]" (dynamic, masked to last 4 digits)
- Resend countdown: "Resend in Xs" (dynamic, counts down from 60)
- Error state (conditional): red OTP boxes + error message if code invalid or expired (dynamic)

AUTO-CALCULATED:
- SMS OTP sent via supabase.auth.mfa.enroll({ factorType: 'phone' })
- Code verification via supabase.auth.mfa.challengeAndVerify()
---

MODAL: MFAVerificationModal
Trigger: Sensitive actions (withdraw funds, change email, remove payout method)
Style: Full-overlay modal

Content:
- Lock icon (48px, orange-600, centered)
- "Confirm Your Identity" (Heading/H2, gray-900, centered)
- Context (Body/Regular, gray-700, centered): "To [action], please verify with your authenticator"
- OTP input (6 boxes, same design as TOTP)
- Method toggle (if multiple methods): "Use SMS instead" OR "Use authenticator app instead" (Body/Small, orange, centered)
- "Use backup code" link (Body/Small, gray-600, centered)
- "Verify" button (Button/Primary/Large, full-width, disabled until 6 digits)
- "Cancel" link (Body/Small, gray-600, centered, 8px below)

---
FIELD INVENTORY — MFAVerificationModal:

INPUT FIELDS (user-editable):
- OTP 6-box input: user enters TOTP or SMS 6-digit code
- Method toggle link (conditional, if multiple methods enrolled): "Use SMS instead" / "Use authenticator app instead"
- "Use backup code" link: switches input to single-field backup code entry
- Backup code text input (conditional): 10-character code, Fira Code font
- "Verify" button: submits MFA challenge (disabled until 6 digits or backup code entered)
- "Cancel" link: dismisses modal without completing sensitive action

DISPLAY FIELDS (read-only):
- Lock icon (48px, orange-600) + "Confirm Your Identity" heading (static)
- Context message: "To [action name], please verify with your authenticator" (dynamic, injected by calling screen)
- Active OTP boxes: active/filled/error states per digit entry (dynamic)
- Error state (conditional): red boxes + "Incorrect code. Try again." (dynamic)

AUTO-CALCULATED:
- MFA challenge via supabase.auth.mfa.challenge(factorId)
- Verification via supabase.auth.mfa.verify({ factorId, challengeId, code })
---

NAVIGATION FLOW:
- Settings → Security → Two-Factor Auth → MFAEnrollmentScreen
- Enrollment → TOTP → QR code → verify → backup codes → done
- Enrollment → SMS → phone → verify code → done
- Withdraw funds → MFAVerificationModal → verify → proceed

FIGMA-SPECIFIC REQUIREMENTS:

- AI Empowerment: Treat these requirements as a starting point. Please provide suggestions for UI/UX improvements, alternative screen layouts, or propose new screens if they create a more ideal user experience.
- AI Collaboration: Please ask clarification questions or push back on any requirements that do not make structural or UX sense.
- Dependencies: Call out any design or flow dependencies you encounter while reading the prompts.
- Recommendations: For any questions or pushback, please provide your specific recommendations for how to proceed.

- Prototype Configuration: Use "Smart Animate" for transitions (300ms ease-in-out)
- Prototype Configuration: Configure overflow scrolling for long content areas
- Prototype Configuration: Add bottom tab bar navigation to all applicable screens
- Prototype Configuration: Link all modal overlays to dismiss on background tap
- Prototype Configuration: Configure keyboard navigation for form flows
- OTP input: 6-box component with active/filled/error states
- QR code placeholder (use a generic test QR image, 200x200px)
- Backup codes grid with monospace Fira Code styling
- Method card variants (totp/sms, set/unset/verified states)
- Recovery codes: download PDF CTA (static mock, not functional prototype)
- Interactive prototype: TOTP setup flow end-to-end (scan → verify → backup codes → done)
- MFAVerificationModal as reusable overlay component
```

---

## FLOW-27: Refunds & Cancellations

**Priority**: P1 (High) — Buyer/seller dispute resolution, platform trust

```
Design refund and cancellation screens. Reference app-overview.md (buyer protection, trade flow), design-system.md, and screen-flow-mapping.md FLOW-27. Backend smoke scripts exist; no mobile UI yet.

SCREENS TO DESIGN (3 total + 1 modal):
1. RequestRefundScreen (buyer-initiated from TradeDetailScreen)
2. RefundStatusScreen (track refund progress)
3. CancelTradeModal (pre-trade cancellation confirmation)
4. RefundHistoryScreen (Settings → Refund History)

Use design-system.md components, clear status communication, empathetic copy.

---

SCREEN 1: RequestRefundScreen
Frame: 375x812px, white background
Navigation: TradeDetailScreen → "Report Issue" → "Request Refund"

Header:
- Back button (top-left)
- "Request a Refund" (Heading/H2, gray-900, centered)

Trade Summary Card (16px padding):
- Gray-50 bg, gray-200 border, 12px radius, 16px padding
- Item thumbnail (60x60px, 10px radius, left)
- Item title (Body/Regular-Medium, gray-900)
- Price (Body/Regular, gray-700): "$24.00"
- Trade ID (Body/Small, gray-400, Fira Code): "TRD-4829"

Refund Reason Section (16px below card):
- "Why are you requesting a refund?" (Body/Regular-Medium, gray-900)
- Reason selector (radio button list, design-system.md):
  - ⚠️ Item not as described
  - 📦 Item was damaged
  - 🚫 Never received item
  - ↩️ Changed my mind
  - 🔍 Other (requires description)

Evidence Upload (16px below reasons, visible for all except "Changed my mind"):
- "Add Photos (Optional)" (Body/Regular-Medium, gray-900)
- Sub-text: "Photos help us resolve your request faster"
- Photo upload grid (3-column, same as FLOW-05 component, max 5 photos)

Description Field (16px below upload, required if "Other" selected):
- "Describe the issue" (Body/Small, gray-600)
- Textarea (design-system.md Form/Input, 6 rows, placeholder: "Please provide details about your issue...")
- Character count: "0/500" (Body/Small, gray-400, right-aligned)

Platform Fee Notice (16px below description):
- Gray-100 bg, 12px radius, 12px padding
- Info icon (20px, gray-600) + notice (Body/Small, gray-700):
  - "Refund Policy: Platform fee (3-5%) is non-refundable unless the seller was at fault."
  - "SP spent will be returned to your wallet if the refund is approved."

Submit Button (fixed to bottom):
- "Submit Refund Request" (Button/Primary/Large, full-width)
- Loading state: "Submitting..."

---
FIELD INVENTORY — RequestRefundScreen:

INPUT FIELDS (user-editable):
- Refund reason radio button group: 5 options (Item Not as Described / Item Not Received / Wrong Item / Damaged Item / Other), required
- "Other" reason text area (conditional): shown when "Other" is selected, freeform, max 500 chars
- Evidence photo upload: optional, up to 4 photos (reuses FLOW-04 photo grid component)
- "Submit Refund Request" button: creates refund_requests record (disabled until reason selected)

DISPLAY FIELDS (read-only):
- Trade summary card (gray-50 bg): item thumbnail, title, price, trade ID (dynamic from DB)
- Refund amount preview: "You'll receive $24.00 refund" (dynamic, equal to trade price)
- SP return preview (conditional, orange text): "250 SP will be returned to your wallet" (dynamic, if SP was used)
- Photo upload grid: up to 4 slots with add-photo tiles and remove X (dynamic)

AUTO-CALCULATED:
- refund_amount = original trade price
- sp_to_return = SP spent on this trade (from trade_sp_allocations)
- createRefundRequest() RPC on Submit
---

SCREEN 2: RefundStatusScreen
Frame: 375x812px, white background
Navigation: TradeDetailScreen → "View Refund Status" OR notification deep link

Header:
- Back button (top-left)
- "Refund Status" (Heading/H2, gray-900, centered)

Status Hero Card (16px padding):
- Status-based gradient:
  - Requested: gray-100 to gray-200
  - Under Review: yellow-50 to yellow-100
  - Approved: green-50 to green-100
  - Denied: red-50 to red-100
  - Completed: teal-50 to teal-100
- Status icon (48px, centered, color per status)
- Status label (Heading/H2, centered, color per status)
- Status description (Body/Regular, gray-700, centered, 8px below label)

Refund Details Section (16px below hero):
- Card (white bg, gray-200 border, 12px radius, 16px padding):
  - Auto-layout vertical, 12px gap:
    - Row: "Request Date" | "May 4, 2026"
    - Row: "Refund Amount" | "$24.00"
    - Row: "SP to Return" | "250 SP" (if applicable, orange)
    - Row: "Payment Method" | "Visa ending in 4242"
    - Row: "Expected Date" | "May 7-9, 2026" (if approved)
    - Divider (if denied):
    - Row: "Decision Reason" | Admin's reason text (gray-700)
    - "Appeal Decision" link (Body/Small, orange, if denied)

Timeline Section (16px below details):
- "Request Timeline" (Heading/H3, gray-900)
- Timeline component (auto-layout vertical, 16px gap):
  - Step 1 (completed): Green dot + "Request Submitted" + "May 4, 2026 2:30 PM"
  - Step 2 (active/pending): Orange dot pulsing + "Under Admin Review" + "~1-3 business days"
  - Step 3 (future): Gray dot + "Decision Made"
  - Step 4 (future): Gray dot + "Refund Processed"

Actions Section (fixed to bottom, if applicable):
- "Contact Support" link (Body/Regular, orange, centered)
- If denied: "Appeal Decision" button (Button/Secondary/Large)

---
FIELD INVENTORY — RefundStatusScreen:

INPUT FIELDS (user-editable):
- "Contact Support" link: navigates to ContactSupportScreen
- "Appeal Decision" button (conditional, Denied state): submits refund appeal
- "Appeal Decision" link (in details card, Denied state): same action as button above

DISPLAY FIELDS (read-only):
- Status hero card: gradient + icon + status label + description (5 states: Requested/Under Review/Approved/Denied/Completed) (dynamic)
- Refund details card: Request Date, Refund Amount, SP to Return (if applicable, orange), Payment Method, Expected Date (if approved), Decision Reason (if denied) (dynamic from refund_requests)
- 4-step timeline: Submitted / Under Review / Decision Made / Processed (step states: completed/active-pulsing/future) (dynamic)

AUTO-CALCULATED:
- Refund state machine from refund_requests.status
- Expected refund date estimate: requested_at + admin_review_sla_days
- SP return amount from trade_sp_allocations
---

MODAL: CancelTradeModal
Trigger: TradeDetailScreen → "Cancel Trade" (before buyer confirms pickup)
Style: Bottom-sheet, 24px top radius

Content (auto-layout vertical, 16px gap, 24px padding):
- Handle bar (40x4px, gray-300, centered, top)
- "Cancel This Trade?" (Heading/H2, gray-900)
- Trade item card (compact, thumbnail + title + price)
- Consequences section (gray-50 bg, 12px radius, 12px padding):
  - "What happens when you cancel:" (Body/Small-Medium, gray-700)
  - List (Body/Small, gray-700):
    - ✅ Full refund to your original payment method
    - ✅ SP returned to your wallet (if SP was used)
    - ❌ Seller will not receive payment
    - ❌ Seller's listing returns to Active status
- Reason input (optional, if buyer cancels):
  - "Reason for cancelling (optional)" (Body/Small, gray-600)
  - Textarea (4 rows)
- Buttons (auto-layout vertical, 12px gap):
  - "Yes, Cancel Trade" (Button/Danger/Large, red-600 bg, full-width)
  - "Keep Trade" (Button/Secondary/Large, full-width)

---
FIELD INVENTORY — CancelTradeModal:

INPUT FIELDS (user-editable):
- Reason textarea (optional): freeform cancellation reason, max 500 chars
- "Yes, Cancel Trade" button: confirms cancellation (triggers trade cancellation + refund flow)
- "Keep Trade" button: dismisses modal, no action taken

DISPLAY FIELDS (read-only):
- "Cancel This Trade?" heading (static)
- Trade item card: thumbnail, title, price (dynamic from active trade)
- Consequences list: 4 bullets (✅ full refund / ✅ SP returned / ❌ seller not paid / ❌ listing re-activated) (static)
- Reason textarea label (static)

AUTO-CALCULATED:
- cancelTrade(tradeId, reason) RPC on confirm — triggers refund + SP reversal
---

SCREEN 3: RefundHistoryScreen
Frame: 375x812px, white background
Navigation: Settings → "Refund History"

Header:
- Back button (top-left)
- "Refund History" (Heading/H2, gray-900, centered)
- Filter button (Body/Small, gray-600, right): "All Statuses" chevron-down

Filter Options: All / Approved / Denied / Pending

Refund History List (auto-layout vertical, 12px gap, 16px padding):

Refund Card (reusable):
- White bg, gray-200 border (1px), 12px radius, 16px padding
- Auto-layout horizontal, 12px gap:
  - Item thumbnail (56x56px, 8px radius)
  - Content (flex-grow, auto-layout vertical, 4px gap):
    - Item title (Body/Regular-Medium, gray-900, 1 line, truncate)
    - Request date (Body/Small, gray-600)
    - Refund amount (Body/Regular, gray-900): "$24.00 refunded"
  - Status badge (right):
    - Approved: green pill
    - Denied: red pill
    - Pending: yellow pill
    - Completed: teal pill

Empty State: "No refund requests yet" + illustration

---
FIELD INVENTORY — RefundHistoryScreen:

INPUT FIELDS (user-editable):
- Status filter button: opens filter sheet (All / Approved / Denied / Pending / Completed)
- Refund card tap: navigates to RefundStatusScreen for that request
- Pull-to-refresh: reloads refund history list

DISPLAY FIELDS (read-only):
- Refund history list: item thumbnail, title, request date, refund amount, status badge pill (Approved/Denied/Pending/Completed with distinct colors) (dynamic from refund_requests)
- Active filter badge (conditional): shown when filter ≠ All (dynamic)
- Empty state (conditional): illustration + "No refund requests yet" (shown when list is empty) (static)

AUTO-CALCULATED:
- getRefundHistory(userId, statusFilter) RPC
- Status badge color mapping: approved=green / denied=red / pending=yellow / completed=teal
---

NAVIGATION FLOW:
- TradeDetailScreen → Report Issue → Request Refund → submit → RefundStatusScreen
- TradeDetailScreen → Cancel Trade → CancelTradeModal → confirm → success state
- Settings → Refund History → list → tap item → RefundStatusScreen
- Notification: "Your refund was approved" → RefundStatusScreen

FIGMA-SPECIFIC REQUIREMENTS:

- AI Empowerment: Treat these requirements as a starting point. Please provide suggestions for UI/UX improvements, alternative screen layouts, or propose new screens if they create a more ideal user experience.
- AI Collaboration: Please ask clarification questions or push back on any requirements that do not make structural or UX sense.
- Dependencies: Call out any design or flow dependencies you encounter while reading the prompts.
- Recommendations: For any questions or pushback, please provide your specific recommendations for how to proceed.

- Prototype Configuration: Use "Smart Animate" for transitions (300ms ease-in-out)
- Prototype Configuration: Configure overflow scrolling for long content areas
- Prototype Configuration: Add bottom tab bar navigation to all applicable screens
- Prototype Configuration: Link all modal overlays to dismiss on background tap
- Prototype Configuration: Configure keyboard navigation for form flows
- Refund reason radio list (5 options, last triggers textarea)
- Status hero card: 5 gradient variants (requested/under-review/approved/denied/completed)
- Timeline with 4 steps, 3 completion states (done/active-pulsing/future)
- CancelTrade modal as bottom-sheet
- Refund card component with 4 status badge variants
- Evidence photo upload (reuse FLOW-05 photo grid component)
- Interactive prototype: request → pending → approved flow end-to-end
```

---

## FLOW-31: Terms of Service

**Priority**: P0 (Critical) — Legal compliance, App Store requirement

```
Design Terms of Service screens. Reference app-overview.md, design-system.md, and screen-flow-mapping.md FLOW-31. Backend complete (SAFETY-010: platform_policies table, policy_acceptances, get_current_policy RPC). TOS acceptance is REQUIRED before account creation.

SCREENS TO DESIGN (2 total + 1 blocking modal):
1. TermsOfServiceScreen (dual-mode: Settings read-only + Signup acceptance)
2. TOSAcceptanceModal (blocking modal on new version publish)

Use design-system.md components, legal clarity, minimal friction for required acceptance.

---

SCREEN 1: TermsOfServiceScreen
Frame: 375x812px, white background
Mode A — Settings (read-only): Navigation: Settings → "Terms of Service"
Mode B — Signup (acceptance required): Embedded in signup flow after account creation

Header:
- Back button (top-left, Mode A only)
- "Terms of Service" (Heading/H2, gray-900, centered)
- Version badge (Body/Small, gray-500, right): "v1.0.0"

Content Header Card (16px padding, Mode B only — acceptance mode):
- Teal-50 bg, teal-600 border-left (4px), 12px padding
- Document icon (20px, teal-700) + "Please read and accept our Terms of Service" (Body/Regular-Medium, teal-900)
- Sub-text: "You must accept to create your account"

Policy Metadata Row (16px padding, auto-layout horizontal, space-between):
- "Effective Date: May 4, 2026" (Body/Small, gray-600)
- "Version 1.0.0" (Body/Small, gray-500)

TOS Content Area (16px padding, scrollable):
- Markdown-rendered content (Body/Regular, gray-800, line-height 26px)
- Sections with bold headings (Body/Regular-Medium, gray-900)
- Content loaded from DB (admin-managed)
- Minimum scroll depth required before Accept button enables (Mode B)

Acceptance Status (Mode A read-only, bottom of content):
- Green-50 bg, 12px radius, 12px padding (if accepted):
  - Checkmark icon (20px, green-600) + "You accepted v1.0.0 on May 1, 2026" (Body/Small, green-800)
- "Not yet accepted" (gray-500, if skipped somehow)

Accept Section (Mode B — fixed to bottom, white bg, shadow top):
- Scroll indicator: "Scroll to read full Terms of Service" (Body/Small, gray-400, centered, fades out once scrolled to bottom)
- Checkbox row (auto-layout horizontal, 12px gap, 16px padding):
  - Checkbox (24x24px, design-system.md, required): unchecked by default
  - Label (Body/Regular, gray-800): "I have read and agree to the Terms of Service"
- "Accept & Continue" button (Button/Primary/Large, full-width, 12px below):
  - Disabled: gray bg, "Accept & Continue" (until checkbox checked)
  - Enabled: orange bg, "Accept & Continue"
- "Decline" link (Body/Small, gray-600, centered, 8px below):
  - Tapping opens DeclineConfirmation alert:
    - "Decline Terms of Service?"
    - "You cannot create an account without accepting our Terms of Service."
    - "Cancel" | "Decline & Exit" (logs out user, returns to Landing)

---
FIELD INVENTORY — TermsOfServiceScreen:

INPUT FIELDS (user-editable):
- Mode B only — Required acceptance checkbox: "I have read and agree to the Terms of Service" (mandatory, unchecked by default)
- Mode B only — "Accept & Continue" button: records TOS acceptance (disabled until checkbox checked)
- Mode B only — "Decline" link: opens DeclineConfirmation alert dialog
- DeclineConfirmation — "Decline & Exit" button: signs out user, returns to LandingScreen
- DeclineConfirmation — "Cancel" button: dismisses alert, user stays on TOS screen

DISPLAY FIELDS (read-only):
- Version badge (top-right header area): "v1.0.0" (dynamic from TOS version in DB)
- TOS markdown content: rendered policy text with bold section headings (dynamic from DB)
- Effective date (dynamic from DB)
- Accepted status chip (Mode A): green pill "Accepted on [date]" (shown in read-only mode if previously accepted) (dynamic)
- Fade scroll gradient: indicates overflow content (dynamic based on scroll position)

AUTO-CALCULATED:
- TOS version from tos_versions table
- User's acceptance status from user_tos_acceptances table
- recordTosAcceptance(userId, version) on Accept
---

SCREEN 2: TOSAcceptanceModal (Version Update)
Trigger: New TOS version published by admin, user opens app
Style: Full-overlay blocking modal (cannot be dismissed without action)

Content (auto-layout vertical, 24px padding, 16px gap):
- Warning icon (48px, orange-600, centered)
- "We've Updated Our Terms" (Heading/H2, gray-900, centered)
- Effective date (Body/Small, gray-600, centered): "Effective May 4, 2026"
- "What changed:" (Body/Regular-Medium, gray-900, 16px below)
- Changes list (auto-layout vertical, 8px gap, Body/Regular, gray-700):
  - Bullet list of key changes (admin-authored)
  - Max 5 bullets, concise
- "Read Full Terms" link (Body/Small, orange, underline, centered) → opens TermsOfServiceScreen
- Divider (gray-200, 16px vertical margin)
- Checkbox row (same as Mode B accept section)
- "Accept New Terms" button (Button/Primary/Large, full-width, disabled until checked)
- "Remind Me Later" link (Body/Small, gray-600, centered, 8px below — if grace period allowed)

---
FIELD INVENTORY — TOSAcceptanceModal:

INPUT FIELDS (user-editable):
- "Read Full Terms" link: opens TermsOfServiceScreen in read-only mode
- Required acceptance checkbox: "I agree to the updated Terms of Service" (mandatory)
- "Accept New Terms" button: records acceptance of new TOS version (disabled until checkbox checked)
- "Remind Me Later" link (conditional): defers modal until next app open (only if grace period is configured in DB)

DISPLAY FIELDS (read-only):
- Warning icon (orange) + "We've Updated Our Terms" heading (static)
- Effective date (dynamic from tos_versions)
- "What changed:" bullet list (dynamic from tos_versions.change_summary, max 5 bullets)
- "Read Full Terms" link (static)

AUTO-CALCULATED:
- Latest TOS version from tos_versions table
- Grace period allowed from tos_versions.grace_period_days
- recordTosAcceptance(userId, version) on Accept
---

NAVIGATION FLOW:
- Signup → account created → TOSAcceptanceModal (blocking) → accept → Onboarding
- Settings → "Terms of Service" → TermsOfServiceScreen (read-only, shows accepted date)
- App open after TOS update → TOSAcceptanceModal (blocking until accepted)
- Decline → logout → LandingScreen

FIGMA-SPECIFIC REQUIREMENTS:

- AI Empowerment: Treat these requirements as a starting point. Please provide suggestions for UI/UX improvements, alternative screen layouts, or propose new screens if they create a more ideal user experience.
- AI Collaboration: Please ask clarification questions or push back on any requirements that do not make structural or UX sense.
- Dependencies: Call out any design or flow dependencies you encounter while reading the prompts.
- Recommendations: For any questions or pushback, please provide your specific recommendations for how to proceed.

- Prototype Configuration: Use "Smart Animate" for transitions (300ms ease-in-out)
- Prototype Configuration: Configure overflow scrolling for long content areas
- Prototype Configuration: Add bottom tab bar navigation to all applicable screens
- Prototype Configuration: Link all modal overlays to dismiss on background tap
- Prototype Configuration: Configure keyboard navigation for form flows
- Dual-mode screen (read-only vs. acceptance) — use Figma variants
- Scroll depth tracking visual: fade gradient on content bottom (indicates more to scroll)
- Checkbox component: required state (cannot proceed without check)
- TOSAcceptanceModal: full-overlay, no dismiss on background tap
- Version badge component (reusable across TOS, Privacy Policy, Disclaimer)
- Accepted confirmation state (green chip with checkmark + date)
- Interactive prototype: signup flow → TOS → accept → continue
```

---

## FLOW-32: Privacy Policy

**Priority**: P0 (Critical) — GDPR/CCPA compliance

```
Design Privacy Policy screens. Reference app-overview.md, design-system.md, and screen-flow-mapping.md FLOW-32. Backend complete (SAFETY-011: reuses platform_policies + policy_acceptances from SAFETY-010). Privacy Policy acceptance is optional (not blocking like TOS).

SCREENS TO DESIGN (2 total + 1 notification modal):
1. PrivacyPolicyScreen (dual-mode: Settings view + optional acceptance)
2. PrivacyPolicyUpdateModal (non-blocking notification of policy changes)
3. DataRightsScreen (Settings → Privacy → Your Data Rights)

Use design-system.md components, transparency-first design, GDPR-compliant copy.

---

SCREEN 1: PrivacyPolicyScreen
Frame: 375x812px, white background
Mirrors TermsOfServiceScreen design (FLOW-31) with these differences:
- Header: "Privacy Policy"
- Mode A (read-only): Settings → Privacy Policy → no acceptance buttons
- Mode B (optional acceptance): Signup → privacy-policy-link → "Accept" button optional, not blocking

Key Differences from TOS:
- Mode B shows "I acknowledge the Privacy Policy" checkbox (not required — user can close without accepting)
- "I Acknowledge" button (Button/Secondary/Large, not Primary — lower emphasis)
- "Close" button (Button/Tertiary/Large) — allows dismissing without accepting
- Acceptance status (if previously acknowledged): green chip as with TOS
- Sections: Data collected, How we use it, Who we share with, Your rights, Contact us

---
FIELD INVENTORY — PrivacyPolicyScreen:

INPUT FIELDS (user-editable):
- Mode B only — Optional acknowledgment checkbox: "I acknowledge the Privacy Policy" (not required)
- Mode B only — "I Acknowledge" button: records optional acknowledgment (Button/Secondary/Large — lower emphasis)
- Mode B only — "Close" button: dismisses screen without acknowledgment (Button/Tertiary/Large)

DISPLAY FIELDS (read-only):
- Version badge (dynamic from privacy_versions table)
- Privacy policy markdown content: 5 sections (Data collected / Use / Sharing / Rights / Contact) (dynamic from DB)
- Effective date (dynamic)
- Acknowledgment status chip (Mode A, conditional): green "Acknowledged on [date]" (dynamic from user_privacy_acceptances)
- Scroll fade gradient (dynamic on overflow)

AUTO-CALCULATED:
- Privacy policy version from privacy_versions table
- User acknowledgment status from user_privacy_acceptances table
- recordPrivacyAcknowledgment() on Acknowledge (optional)
---

SCREEN 2: PrivacyPolicyUpdateModal
Trigger: New Privacy Policy version published, user opens app (non-blocking — can dismiss)
Style: Bottom-sheet (not full-overlay — can be dismissed)

Content (auto-layout vertical, 24px padding, 16px gap):
- Handle bar (40x4px, gray-300, top-center)
- Shield icon (40px, teal-600, centered)
- "Privacy Policy Updated" (Heading/H2, gray-900, centered)
- Date (Body/Small, gray-600, centered): "Effective May 4, 2026"
- Changes list (Body/Regular, gray-700, auto-layout vertical, 8px gap):
  - Bullet points of key changes
- "Review Policy" button (Button/Primary/Large, full-width): opens PrivacyPolicyScreen
- "Dismiss" link (Body/Small, gray-600, centered, 8px below)
- Settings tab badge indicator: orange dot on Settings icon until acknowledged

---
FIELD INVENTORY — PrivacyPolicyUpdateModal:

INPUT FIELDS (user-editable):
- "Review Policy" button: opens PrivacyPolicyScreen in read-only mode
- "Dismiss" link: dismisses bottom-sheet, clears Settings badge dot when tapped
- Swipe-down or tap-outside gesture: dismisses modal (non-blocking)

DISPLAY FIELDS (read-only):
- Shield icon (teal-600) + "Privacy Policy Updated" heading (static)
- Effective date (dynamic from privacy_versions table)
- Change bullet list: key changes (dynamic from privacy_versions.change_summary, max 5 bullets)
- Settings tab badge dot (conditional): shown until user taps Dismiss or Review Policy (dynamic)

AUTO-CALCULATED:
- Latest privacy version from privacy_versions table
- Badge dot clears when user interacts with modal (dismisses or reviews)
---

SCREEN 3: DataRightsScreen
Frame: 375x812px, white background
Navigation: Settings → Privacy → "Your Data Rights"

Header:
- Back button + "Your Data Rights" (Heading/H2, gray-900, centered)

Data Rights Cards (auto-layout vertical, 16px gap, 16px padding):

1. Download Your Data Card:
- White bg, gray-200 border, 12px radius, 16px padding
- Download icon (32px, teal-600) + "Download Your Data" (Heading/H3, gray-900)
- Sub-text (Body/Small, gray-600): "Get a copy of all data we have about your account"
- Status states:
  - Default: "Request Data Export" button (Button/Secondary/Medium)
  - Requested: "Export Requested — Processing (up to 24 hours)" (yellow badge)
  - Ready: "Download Ready" (green badge) + "Download File" button (Button/Primary/Medium)

2. Delete Account Card:
- White bg, red-100 border, 12px radius, 16px padding
- Trash icon (32px, red-600) + "Delete Your Account" (Heading/H3, red-800)
- Sub-text (Body/Small, red-700): "Permanently delete your account and all associated data. This cannot be undone."
- "Request Account Deletion" button (Button/Danger/Medium)
- Deletion Confirmation Modal:
  - "Are you sure?" (Heading/H2)
  - "Type DELETE to confirm" text input
  - "Permanently Delete Account" (Button/Danger/Large, disabled until input matches)
  - "Cancel" link

3. Cookie Preferences Card (future):
- Gray-100 bg, gray-200 border, 12px radius, 16px padding
- Cookie icon (32px, gray-400) + "Cookie Preferences" (Heading/H3, gray-500)
- "Coming soon — web app feature" (Body/Small, gray-400)

---
FIELD INVENTORY — DataRightsScreen:

INPUT FIELDS (user-editable):
- "Request Data Export" button: submits data export request (transitions to Requested state)
- "Download File" button (conditional, Ready state): downloads prepared export file
- "Request Account Deletion" button: opens Account Deletion Confirmation Modal
- Deletion Confirmation Modal — text input: user must type "DELETE" to confirm
- Deletion Confirmation Modal — "Permanently Delete Account" button: submits deletion request (disabled until input = "DELETE")
- Deletion Confirmation Modal — "Cancel" link: dismisses modal, no action

DISPLAY FIELDS (read-only):
- Download Your Data card: status state (Default / Requested-Processing / Ready-to-Download) (dynamic)
- Delete Account card (red-100 bg): permanent warning text (static)
- Cookie Preferences card (gray-100): "Coming soon" placeholder (static)

AUTO-CALCULATED:
- Export status from data_export_requests table
- requestDataExport(userId) on Request
- requestAccountDeletion(userId) on Confirm
---

NAVIGATION FLOW:
- Signup → TOS accepted → Privacy Policy link → PrivacyPolicyScreen (optional ack)
- Settings → Privacy Policy → PrivacyPolicyScreen (read-only)
- App open after PP update → PrivacyPolicyUpdateModal (bottom-sheet, dismissible)
- Settings → Privacy → Your Data Rights → DataRightsScreen → download/delete

FIGMA-SPECIFIC REQUIREMENTS:

- AI Empowerment: Treat these requirements as a starting point. Please provide suggestions for UI/UX improvements, alternative screen layouts, or propose new screens if they create a more ideal user experience.
- AI Collaboration: Please ask clarification questions or push back on any requirements that do not make structural or UX sense.
- Dependencies: Call out any design or flow dependencies you encounter while reading the prompts.
- Recommendations: For any questions or pushback, please provide your specific recommendations for how to proceed.

- Prototype Configuration: Use "Smart Animate" for transitions (300ms ease-in-out)
- Prototype Configuration: Configure overflow scrolling for long content areas
- Prototype Configuration: Add bottom tab bar navigation to all applicable screens
- Prototype Configuration: Link all modal overlays to dismiss on background tap
- Prototype Configuration: Configure keyboard navigation for form flows
- Non-blocking bottom-sheet (dismissible with swipe or tap outside)
- Settings badge/dot component (unread policy update indicator)
- Data Rights cards: 3 variants (download, delete, future)
- Download status states (idle/requested/ready)
- Account deletion modal with text confirmation input
- DataRightsScreen matches teal safety aesthetic
- Interactive prototype: PP update modal → review → dismiss
```

---

## FLOW-33: Liability Disclaimer

**Priority**: P0 (Critical) — Legal protection, mandatory per-trade acknowledgment

```
Design liability disclaimer screens. Reference app-overview.md, design-system.md, and screen-flow-mapping.md FLOW-33. Backend complete (SAFETY-012: DisclaimerModal.tsx + LiabilityDisclaimerScreen.tsx + acknowledge_trade_disclaimer RPC). Disclaimer is MANDATORY — must be acknowledged before every trade.

SCREENS TO DESIGN (1 screen + 2 modals):
1. LiabilityDisclaimerScreen (Settings read-only reference)
2. DisclaimerModal (BLOCKING modal during trade initiation — mandatory checkbox)
3. ListingPublishDisclaimerModal (before first listing creation)

Use design-system.md components, security/legal tone, no room for accidental acceptance.

---

SCREEN 1: LiabilityDisclaimerScreen
Frame: 375x812px, white background
Navigation: Settings → "Liability Disclaimer" (shield-outline icon)

Header:
- Back button + "Liability Disclaimer" (Heading/H2, gray-900, centered)
- Version badge (Body/Small, gray-500, right): "v1.0.0"

Info Notice Banner (16px padding):
- Gray-100 bg, gray-400 border-left (4px), 12px padding
- Info icon (20px, gray-600) + "This disclaimer is shown when you make a purchase" (Body/Small, gray-700)

Policy Metadata (16px padding, auto-layout horizontal, space-between):
- "Effective Date: May 4, 2026" (Body/Small, gray-600)
- "Version 1.0.0" (Body/Small, gray-500)

Content (16px padding, scrollable):
- Markdown-rendered disclaimer content (Body/Regular, gray-800, line-height 26px)
- Key sections (bold headings): Platform Role, User Responsibilities, Item Inspection, Meeting Safety, Dispute Resolution

Acknowledgment History (bottom of content, 16px padding):
- "You have acknowledged this disclaimer [N] times" (Body/Small, green-700)
- Last acknowledged: "Last trade: May 3, 2026" (Body/Small, gray-600)

---
FIELD INVENTORY — LiabilityDisclaimerScreen:

INPUT FIELDS (user-editable):
- None (read-only settings reference screen)

DISPLAY FIELDS (read-only):
- Version badge (top-right): "v1.0.0" (dynamic from disclaimer_versions table)
- Info notice banner: "This disclaimer is shown when you make a purchase" (static)
- Effective date + version metadata row (dynamic)
- Full disclaimer markdown content: rendered policy sections with bold headings (dynamic from DB)
- Acknowledgment history (conditional): "You have acknowledged this disclaimer N times" + last acknowledgment date (dynamic from disclaimer_acknowledgments table)

AUTO-CALCULATED:
- Disclaimer content from disclaimer_versions table (latest version)
- Acknowledgment count + last acknowledged date from disclaimer_acknowledgments for current user
---

MODAL 1: DisclaimerModal (Per-Trade, BLOCKING)
Trigger: Buyer taps "Confirm Purchase" on TradeInitiationScreen
Style: Full-overlay blocking modal (cannot dismiss without checkbox + accept OR cancel)

Content (auto-layout vertical, 24px padding, 16px gap):
- Handle bar (decorative, 40x4px, gray-300, top-center)
- Shield icon (48px, orange-600, centered)
- "Liability Disclaimer" (Heading/H2, gray-900, centered)
- Version badge (inline): "v1.0.0"

Trade Context Card (gray-50 bg, 12px radius, 12px padding):
- "Acknowledging for:" (Body/Small, gray-600)
- Item title (Body/Regular-Medium, gray-900): "Fisher-Price Activity Gym"
- Price (Body/Regular, gray-700): "$24.00"

Disclaimer Content (ScrollView, max-height 300px, gray-50 bg, 12px radius, 12px padding):
- Full disclaimer text (Body/Small, gray-700, line-height 22px)
- Fade gradient at bottom if content overflows (scroll indicator)

Acknowledgment Checkbox (16px below content):
- Mandatory checkbox (24x24px, cannot proceed without checking):
  - Unchecked state: gray-300 border
  - Checked state: orange fill, white checkmark
- Label (Body/Regular, gray-800): "I have read and acknowledge this disclaimer"
- Sub-label (Body/Small, gray-500): "Required to complete your purchase"

Buttons (auto-layout vertical, 12px gap, fixed to bottom of modal):
- "Accept & Continue" (Button/Primary/Large, full-width, disabled until checkbox checked):
  - Disabled: gray-300 bg, gray-500 text, lock icon
  - Enabled: orange bg, white text, lock icon
- "Cancel" (Button/Secondary/Large, full-width): returns to TradeInitiationScreen

Error State (if disclaimer load fails):
- Error card (red-50 bg, red-200 border, 12px radius): "Unable to load disclaimer. Tap to retry."
- "Retry" button (Button/Secondary/Medium, centered)
- "Cancel" link

---
FIELD INVENTORY — DisclaimerModal:

INPUT FIELDS (user-editable):
- Mandatory acknowledgment checkbox: "I have read and acknowledge this disclaimer" (required, always resets to unchecked on open)
- "Accept & Continue" button: records acknowledgment + proceeds with trade (disabled until checkbox checked)
- "Cancel" button: returns user to TradeInitiationScreen without proceeding
- Error state — "Retry" button: re-fetches disclaimer content
- Error state — "Cancel" link: returns to TradeInitiationScreen

DISPLAY FIELDS (read-only):
- Trade context card (gray-50 bg): item title + price for which the disclaimer is being acknowledged (dynamic from trade context)
- Disclaimer content (ScrollView, max-height 300px): full disclaimer text with fade gradient at bottom if overflow (dynamic from disclaimer_versions)
- Checkbox in unchecked/checked/error states (dynamic)
- "Accept & Continue" button: lock icon when disabled, orange when enabled (dynamic)

AUTO-CALCULATED:
- Disclaimer content from getLatestDisclaimer() RPC
- acknowledge_trade_disclaimer(tradeId, disclaimerVersionId) on Accept
---

MODAL 2: ListingPublishDisclaimerModal (First Listing)
Trigger: Before seller's FIRST listing publication
Style: Full-overlay modal (one-time, not per-listing)

Content:
- Megaphone icon (48px, teal-600, centered)
- "Before You List Your First Item" (Heading/H2, gray-900, centered)
- Card (teal-50 bg, 12px radius, 16px padding):
  - "As a seller, you are responsible for:" (Body/Regular-Medium, gray-900)
  - Responsibilities list (Body/Regular, gray-700, auto-layout vertical, 8px gap):
    - ✓ Accurate item descriptions (no misleading info)
    - ✓ Item safety (CPSC compliance for children's items)
    - ✓ Safe meetup coordination
    - ✓ Responding to buyer messages
- "Read Full Disclaimer" link (Body/Small, orange, underline)
- Checkbox: "I understand my responsibilities as a seller" (mandatory)
- "Accept & Publish" button (Button/Primary/Large, full-width, disabled until checked)
- "Cancel" link (Body/Small, gray-600)

---
FIELD INVENTORY — ListingPublishDisclaimerModal:

INPUT FIELDS (user-editable):
- "Read Full Disclaimer" link: opens LiabilityDisclaimerScreen in read-only mode
- Mandatory checkbox: "I understand my responsibilities as a seller" (required, shown once before first listing only)
- "Accept & Publish" button: records seller disclaimer acceptance + publishes listing (disabled until checkbox checked)
- "Cancel" link: dismisses modal, returns user to ItemCreateScreen without publishing

DISPLAY FIELDS (read-only):
- Megaphone icon (teal-600) + "Before You List Your First Item" heading (static)
- Seller responsibilities card (teal-50 bg): 4 responsibility bullets (static)
- "Read Full Disclaimer" link (static)

AUTO-CALCULATED:
- Shown only once (profiles.seller_disclaimer_accepted_at IS NULL)
- Sets profiles.seller_disclaimer_accepted_at on Accept
- Listing becomes Active after acknowledgment
---

NAVIGATION FLOW:
- TradeInitiationScreen → "Confirm Purchase" → DisclaimerModal → checkbox check → "Accept" → trade proceeds
- TradeInitiationScreen → "Confirm Purchase" → DisclaimerModal → "Cancel" → returns to TradeInitiationScreen
- First listing → ItemCreateScreen → publish → ListingPublishDisclaimerModal → accept → listing goes live
- Settings → "Liability Disclaimer" → LiabilityDisclaimerScreen (read-only, shows acknowledgment count)

FIGMA-SPECIFIC REQUIREMENTS:

- AI Empowerment: Treat these requirements as a starting point. Please provide suggestions for UI/UX improvements, alternative screen layouts, or propose new screens if they create a more ideal user experience.
- AI Collaboration: Please ask clarification questions or push back on any requirements that do not make structural or UX sense.
- Dependencies: Call out any design or flow dependencies you encounter while reading the prompts.
- Recommendations: For any questions or pushback, please provide your specific recommendations for how to proceed.

- Prototype Configuration: Use "Smart Animate" for transitions (300ms ease-in-out)
- Prototype Configuration: Configure overflow scrolling for long content areas
- Prototype Configuration: Add bottom tab bar navigation to all applicable screens
- Prototype Configuration: Link all modal overlays to dismiss on background tap
- Prototype Configuration: Configure keyboard navigation for form flows
- DisclaimerModal: full-overlay non-dismissible (no tap-outside to close)
- Mandatory checkbox: distinct required state (separate from optional checkboxes in other flows)
- Checkbox Reset: resets to unchecked every time DisclaimerModal opens (no pre-checked state)
- Lock icon on disabled Accept button (reinforces security requirement)
- Fade gradient scroll indicator on content overflow
- Content max-height with scroll (not full-page scroll — keep buttons always visible)
- Trade context card embedded in modal (which item the disclaimer applies to)
- Interactive prototype: TradeInitiationScreen → DisclaimerModal → checkbox → Accept → success
- DisclaimerModal error state with retry
```

---

### 📊 FINAL STATISTICS (UPDATED — COMPREHENSIVE COVERAGE):

**Total Flows**: 27
**Total Screens**: 100+ screens designed
**Total Components**: 70+ reusable components
**New Features**: Cart/Multi-item checkout (FLOW-07), ID Verification (FLOW-21), Seller Payouts (FLOW-22/23), MFA (FLOW-24), Refunds (FLOW-27), Legal Compliance (FLOW-31/32/33)

**Screen Breakdown by Priority**:
- **P0 (Critical)**: 50 screens — Auth, Discovery, Listings, Cart, Trade, SP Wallet, ID Verification, TOS, Privacy Policy, Liability Disclaimer
- **P1 (High)**: 38 screens — Messaging, Notifications, Subscriptions, Safety, Education, Seller Payouts, MFA, Refunds
- **P2 (Medium)**: 12 screens — Referrals, Support

**New Flows Added (Coverage Gap Fix)**:
- ✅ FLOW-19: Trading Education (3 screens + SP Calculator component)
- ✅ FLOW-21: ID Verification Mobile (2 screens)
- ✅ FLOW-22/23: Seller Payouts & Payout Method Verification (2 screens)
- ✅ FLOW-24: MFA Enrollment (3 screens + verification modal)
- ✅ FLOW-27: Refunds & Cancellations (3 screens + cancel modal)
- ✅ FLOW-31: Terms of Service (2 screens + blocking modal)
- ✅ FLOW-32: Privacy Policy (3 screens + update modal)
- ✅ FLOW-33: Liability Disclaimer (1 screen + 2 modals)

**Component Categories**:
- Form components (inputs, selectors, steppers, OTP boxes)
- Card variants (item, trade, transaction, notification, payout, refund)
- Navigation (bottom tabs, headers, breadcrumbs)
- Modals (full-overlay blocking, bottom-sheet, action-sheet)
- Interactive (sliders, toggles, checkboxes, swipe actions, accordions)
- Status indicators (badges, timelines, progress, verification states)
- Media (image grids, upload zones, QR codes, carousels)
- Messaging (bubbles, threads, quick replies)
- Legal (policy viewers, acceptance checkboxes, version badges)
- Security (OTP inputs, MFA method cards, backup codes)

---

### 💡 KEY DELIVERABLES IN THIS DOCUMENT:

✨ **Complete Design System Integration**: Every prompt references design-system.md for colors, typography, spacing
✨ **Samsung Food Aesthetic**: Warm orange (#FF6B35), teal (#00A896), clean modern layouts
✨ **Copy-Paste Ready**: Each prompt can be directly pasted into Figma Make text boxes
✨ **Contextual References**: Links to app-overview.md, design-system.md, screen-flow-mapping.md
✨ **Figma-Specific Requirements**: Component variants, prototypes, instance swaps, animations
✨ **100% Flow Coverage**: All 27 customer-facing flows from flow-registry.md covered
✨ **Legal Compliance**: TOS, Privacy Policy, Liability Disclaimer — App Store ready
✨ **NEW Cart Flow**: Complete multi-item checkout with SP allocation strategies (MVP-critical)
✨ **Seller Monetization**: Full payout management and Stripe Connect onboarding
✨ **Security Flows**: MFA enrollment, ID verification, liability acknowledgment

This document is production-ready for Figma Make implementation! 🚀