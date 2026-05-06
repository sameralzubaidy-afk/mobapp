# MODULE 15.1: UI REDESIGN — PASS IT UP (WHISK-INSPIRED DESIGN SYSTEM)

**Total Tasks:** 27 flow-based tasks (68 screens total)  
**Estimated Time:** ~160 hours (4 weeks)  
**Task Structure:** One task per flow — each task covers all screens in that flow  
**Module Scope:** Visual redesign only — colors, fonts, icons, spacing, layout. No backend, API, validation, or business logic changes.

**Design References:**
- `design-system-passitup.md` — Complete design system specification
- `screen-flow-mapping.md` — All 68 screens mapped to 27 flows
- `implementation-guide.md` — Asset acquisition & icon catalog

---

## 🎨 REQUIRED ASSETS

### Icons — Phosphor Icons (`phosphor-react-native@3.0.6`)
> ✅ Already installed via `npx expo install phosphor-react-native`

```typescript
// Import pattern (use in every redesigned screen):
import { House, Lock, Eye, EyeSlash } from 'phosphor-react-native';

// Usage:
<Lock size={20} color="#6B6B6B" weight="regular" />
```

See `implementation-guide.md` Section 4 for the full icon catalog.

### Illustrations — Storyset (free, commercial license)
Four PNG files required for onboarding carousel:

| Filename | Scene | Dimensions |
|----------|-------|------------|
| `onboarding-sp-earning.png` | Coins, piggy bank, confetti | 560×420px (280×210pt @2x) |
| `onboarding-safe-trading.png` | Handshake, shield, location pin | 560×420px |
| `onboarding-marketplace.png` | Families browsing kids items | 560×420px |
| `onboarding-sustainable.png` | Recycling arrows, plants, earth | 560×420px |

**Customise in Storyset:** Primary `#5DBB8E`, Accent `#F59E0B`. Export PNG with transparency @2x.  
**Storage:** `src/assets/illustrations/`

---

## 🛠 GLOBAL DESIGN SYSTEM RULES

These rules apply to **every screen in this module** without exception:

| Rule | Value |
|------|-------|
| Primary color | `#5DBB8E` (Whisk green) |
| Text — primary | `#1A1A1A` |
| Text — secondary | `#6B6B6B` |
| Text — tertiary / placeholder | `#999999` |
| Error color | `#E85D75` |
| SP / rewards accent | `#F59E0B` (gold) |
| Screen background | `#FFFFFF` |
| Input fill color | `#F0F0F0` |
| Input border radius | `12px` |
| Input border | **None** — filled style, no `borderWidth` |
| Input height | `52px` |
| Primary button height | `52px` |
| Primary button border radius | `26px` (height ÷ 2 = pill shape) |
| Screen horizontal padding | `20–24px` |
| Section vertical spacing | `16–20px` |
| Font family | Inter (via `@expo-google-fonts/inter`) or system font |
| Heading size | `24–28px`, `fontWeight: '600'` |
| Body text size | `16px`, regular |
| Input label size | `13px`, `fontWeight: '500'`, uppercase |
| Icon package | **Phosphor Icons only** — no Ionicons, no MaterialIcons, no react-native-vector-icons |

---

## 📱 IMPLEMENTATION TASKS (ORGANIZED BY FLOW)

---

## PHASE 1: CRITICAL FLOWS (P0 — MVP BLOCKING)

---

### TASK FLOW-01: Authentication & Session Management

**Duration:** 20 hours  
**Priority:** P0 (Critical) — First user touchpoint  
**Screens:** 7 total  
**Asset Dependencies:** `EnvelopeSimple`, `Lock`, `Eye`, `EyeSlash`, `WarningCircle`, `CheckSquare`, `Square`

---

> **🚫 FROZEN — UI REDESIGN SCOPE ONLY**
>
> This task is **visual redesign only**. Do NOT change any of the following in any screen within this task:
> - **Supabase / API calls** — all `supabase.auth.*`, RPC, and Edge Function calls stay exactly as-is
> - **Form validation** — all validation rules, error conditions, character limits, and error text stay exactly as-is
> - **Navigation / routing** — screen names, navigator structure, and all `navigation.navigate()` / `navigation.goBack()` calls stay exactly as-is
> - **State management** — all `useState`, `useReducer`, Redux, and Context logic stays exactly as-is; only JSX structure and `StyleSheet` values change
> - **Business logic** — OTP countdown timer, session management, any non-UI function bodies stay exactly as-is
> - **Data models** — TypeScript interfaces, prop types, and DB schema stay exactly as-is
>
> **Only modify:** `StyleSheet` values · icon imports (swap any existing icons → Phosphor) · JSX layout (flex/positioning) · colors · font sizes · spacing · add/remove purely visual wrapper `<View>` elements

---

#### Description
Redesign all 7 authentication screens to the Whisk-inspired design system. The auth flow is the first impression users have — screens must feel clean, minimal, and trustworthy. All previous orange/legacy brand colors are replaced with `#5DBB8E` green. Inputs switch to the filled style (no borders). All icons switch to Phosphor.

#### Scope — Files to Modify

| # | Screen | File | Change Type |
|---|--------|------|-------------|
| 1 | Landing Screen | `src/screens/auth/LandingScreen.tsx` | Restyle only |
| 2 | Login Screen | `src/screens/auth/LoginScreen.tsx` | Restyle only |
| 3 | Signup Screen | `src/screens/auth/SignupScreen.tsx` | Restyle only |
| 4 | Phone Verification | `src/screens/auth/PhoneVerificationScreen.tsx` | Restyle only |
| 5 | Forgot Password | `src/screens/auth/ForgotPasswordScreen.tsx` | Restyle only |
| 6 | Reset Password | `src/screens/auth/ResetPasswordScreen.tsx` | Restyle only |
| 7 | Suspended Account | `src/screens/auth/SuspendedAccountScreen.tsx` | Restyle only |

---

#### Per-Screen Design Specs & AI Prompts

##### Screen 1 of 7: Landing Screen
**File:** `src/screens/auth/LandingScreen.tsx` | **Duration:** 3h

**Design Specs:**
- White background, centered vertical layout
- App emoji or logo placeholder (optional, 80px)
- Headline: "Welcome to Pass It Up" — 28px, `fontWeight '600'`, `#1A1A1A`, centered
- Subheading: "Buy, sell, and trade gently used kids' items locally" — 15px, `#6B6B6B`, centered, `lineHeight 22`
- Primary CTA: "Get Started" — green pill, 52px height, `borderRadius 26`, full width
- Secondary CTA: "Already have an account? Log In" — 14px, `#6B6B6B`, text-only

**AI Prompt:**
```typescript
/*
TASK: Redesign LandingScreen — VISUAL ONLY
DO NOT CHANGE: navigation.navigate() calls, any existing logic
ONLY CHANGE: StyleSheet, colors, layout structure

DESIGN SYSTEM:
- Background: #FFFFFF
- Primary button: backgroundColor '#5DBB8E', borderRadius 26, height 52
- Headline: fontSize 28, fontWeight '600', color '#1A1A1A', textAlign 'center'
- Subheading: fontSize 15, color '#6B6B6B', lineHeight 22, textAlign 'center'
- Screen padding: paddingHorizontal 24
*/

// filepath: src/screens/auth/LandingScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const LandingScreen = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>🤝</Text>
        <Text style={styles.headline}>Welcome to Pass It Up</Text>
        <Text style={styles.subheading}>
          Buy, sell, and trade gently used kids' items locally
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('Signup')} // DO NOT CHANGE
        >
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('Login')} // DO NOT CHANGE
        >
          <Text style={styles.secondaryButtonText}>
            Already have an account? Log In
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emoji: { fontSize: 80, marginBottom: 24 },
  headline: { fontSize: 28, fontWeight: '600', color: '#1A1A1A', textAlign: 'center', marginBottom: 8 },
  subheading: { fontSize: 15, color: '#6B6B6B', textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  primaryButton: { width: '100%', height: 52, backgroundColor: '#5DBB8E', borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  primaryButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  secondaryButton: { paddingVertical: 12 },
  secondaryButtonText: { fontSize: 14, color: '#6B6B6B' },
});

export default LandingScreen;
```

---

##### Screen 2 of 7: Login Screen
**File:** `src/screens/auth/LoginScreen.tsx` | **Duration:** 4h

**Design Specs:**
- Heading: "Log In" — 24px semibold
- Email input: filled style, label "EMAIL" (13px uppercase `#6B6B6B`), `EnvelopeSimple` icon left (20px)
- Password input: filled style, label "PASSWORD", `Lock` icon left (20px), `Eye`/`EyeSlash` toggle right (20px)
- "Forgot password?" — 14px, `#5DBB8E`, `alignSelf: 'flex-end'` below password field
- "Log In" button — green pill, 52px, full width
- OR divider — 1px `#E0E0E0` lines + "or" text (13px, `#6B6B6B`)
- Social login — 3 circles 50×50px, white bg, `#E0E0E0` border, centered
- "Don't have an account? Sign Up" — 14px gray + green "Sign Up"

**AI Prompt:**
```typescript
/*
TASK: Redesign LoginScreen — VISUAL ONLY
DO NOT CHANGE: handleLogin(), supabase.auth.signInWithPassword(), form validation, navigation calls
ONLY CHANGE: StyleSheet, swap existing icons → Phosphor, layout

PHOSPHOR ICONS: import { EnvelopeSimple, Lock, Eye, EyeSlash } from 'phosphor-react-native';
FILLED INPUT: backgroundColor '#F0F0F0', borderRadius 12, height 52, NO borderWidth
LABEL: fontSize 13, fontWeight '500', color '#6B6B6B', textTransform 'uppercase', marginBottom 8
PRIMARY BUTTON: backgroundColor '#5DBB8E', borderRadius 26, height 52
SOCIAL BUTTONS: width 50, height 50, borderRadius 25, backgroundColor '#FFFFFF', borderWidth 1, borderColor '#E0E0E0'
*/

// filepath: src/screens/auth/LoginScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { EnvelopeSimple, Lock, Eye, EyeSlash } from 'phosphor-react-native';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = () => {
    // DO NOT CHANGE — preserve existing supabase auth logic here
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.heading}>Log In</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>EMAIL</Text>
            <View style={styles.inputWrapper}>
              <EnvelopeSimple size={20} color="#6B6B6B" weight="regular" style={{ marginRight: 12 }} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#999999"
                keyboardType="email-address" // DO NOT CHANGE
                autoCapitalize="none"         // DO NOT CHANGE
                autoCorrect={false}           // DO NOT CHANGE
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.inputWrapper}>
              <Lock size={20} color="#6B6B6B" weight="regular" style={{ marginRight: 12 }} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor="#999999"
                secureTextEntry={!showPassword} // DO NOT CHANGE
                autoCapitalize="none"            // DO NOT CHANGE
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                {showPassword
                  ? <EyeSlash size={20} color="#1A1A1A" weight="regular" />
                  : <Eye size={20} color="#1A1A1A" weight="regular" />
                }
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.forgotButton}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryButton} onPress={handleLogin}>
            <Text style={styles.primaryButtonText}>Log In</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <Text style={styles.socialLabel}>Continue with</Text>
          <View style={styles.socialIcons}>
            {/* DO NOT CHANGE: onPress handlers for social login */}
            <TouchableOpacity style={styles.socialButton}><Text style={styles.socialText}>G</Text></TouchableOpacity>
            <TouchableOpacity style={styles.socialButton}><Text style={styles.socialText}></Text></TouchableOpacity>
            <TouchableOpacity style={styles.socialButton}><Text style={styles.socialText}>f</Text></TouchableOpacity>
          </View>

          <TouchableOpacity style={{ paddingVertical: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, color: '#6B6B6B' }}>
              Don't have an account? <Text style={{ color: '#5DBB8E', fontWeight: '500' }}>Sign Up</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 24 },
  heading: { fontSize: 24, fontWeight: '600', color: '#1A1A1A', marginBottom: 24 },
  inputContainer: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '500', color: '#6B6B6B', textTransform: 'uppercase', marginBottom: 8 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0F0', borderRadius: 12, height: 52, paddingHorizontal: 16 },
  input: { flex: 1, fontSize: 16, color: '#1A1A1A' },
  forgotButton: { alignSelf: 'flex-end', marginBottom: 24 },
  forgotText: { fontSize: 14, color: '#5DBB8E' },
  primaryButton: { width: '100%', height: 52, backgroundColor: '#5DBB8E', borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  primaryButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E0E0E0' },
  dividerText: { fontSize: 13, color: '#6B6B6B', marginHorizontal: 12 },
  socialLabel: { fontSize: 13, color: '#6B6B6B', textAlign: 'center', marginBottom: 16 },
  socialIcons: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 24 },
  socialButton: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center' },
  socialText: { fontSize: 20, fontWeight: '600', color: '#1A1A1A' },
});

export default LoginScreen;
```

---

##### Screen 3 of 7: Signup Screen
**File:** `src/screens/auth/SignupScreen.tsx` | **Duration:** 4h

**Design Specs:**
- Heading: "Create Account" — 24px semibold
- Same filled input style as Login: email, password, confirm password
- Terms & Privacy checkbox: `CheckSquare`/`Square` (20px, `#5DBB8E` when checked / `#6B6B6B` unchecked) with 14px inline text and green links
- Primary CTA: "Sign Up" — green pill, 52px

**AI Prompt:**
```typescript
/*
TASK: Redesign SignupScreen — VISUAL ONLY
DO NOT CHANGE: supabase.auth.signUp(), password match validation, email format validation, navigation
ONLY CHANGE: StyleSheet, swap icons → Phosphor, layout

PHOSPHOR ICONS:
import { EnvelopeSimple, Lock, Eye, EyeSlash, CheckSquare, Square } from 'phosphor-react-native';

CHECKBOX PATTERN (visual only — do not change the state toggle logic):
{termsAccepted
  ? <CheckSquare size={20} color="#5DBB8E" weight="fill" />
  : <Square size={20} color="#6B6B6B" weight="regular" />
}

DESIGN SPECS: Mirror LoginScreen's filled input style exactly.
- Add password confirmation field (same style as password field)
- Heading: "Create Account"
- Submit button: "Sign Up"
*/
// filepath: src/screens/auth/SignupScreen.tsx
// Apply same StyleSheet pattern as LoginScreen
// DO NOT alter supabase.auth.signUp() call or any validation logic
```

---

##### Screen 4 of 7: Phone Verification Screen
**File:** `src/screens/auth/PhoneVerificationScreen.tsx` | **Duration:** 3h

**Design Specs:**
- Fully centered layout (`alignItems: 'center'`, `justifyContent: 'center'`)
- Heading: "Verify Your Phone" — 24px semibold, centered
- Subtext: "Enter the 6-digit code sent to [phone]" — 15px, `#6B6B6B`, centered
- OTP input: filled style (`#F0F0F0`, `borderRadius 12`, `height 52`), `textAlign: 'center'`, `fontSize 24`, `letterSpacing 8`, monospace feel
- "Verify" button — green pill, 52px, full width
- "Didn't receive code? Resend" — 14px, `#5DBB8E` (preserve existing resend timer logic)
- "Change phone number" — 14px, `#6B6B6B`

**AI Prompt:**
```typescript
/*
TASK: Redesign PhoneVerificationScreen — VISUAL ONLY
DO NOT CHANGE: OTP submit handler, resend countdown timer logic, supabase phone auth calls, navigation
ONLY CHANGE: StyleSheet values and layout

DESIGN SPEC FOR OTP INPUT (do not change maxLength, keyboardType, onChangeText):
inputWrapper: {
  backgroundColor: '#F0F0F0',
  borderRadius: 12,
  height: 52,
  paddingHorizontal: 16,
  width: '100%',
  alignItems: 'center',
  justifyContent: 'center',
}
otpInput: {
  fontSize: 24,
  fontWeight: '600',
  color: '#1A1A1A',
  textAlign: 'center',
  letterSpacing: 8,
  width: '100%',
}

LAYOUT: All content center-aligned (alignItems: 'center')
VERIFY BUTTON: backgroundColor '#5DBB8E', borderRadius 26, height 52, width '100%'
RESEND LINK: fontSize 14, color '#5DBB8E'
CHANGE PHONE: fontSize 14, color '#6B6B6B'
*/
// filepath: src/screens/auth/PhoneVerificationScreen.tsx
```

---

##### Screen 5 of 7: Forgot Password Screen
**File:** `src/screens/auth/ForgotPasswordScreen.tsx` | **Duration:** 2h

**Design Specs:**
- Heading: "Forgot Password?" — 24px semibold
- Subtext: "Enter your email and we'll send a reset link" — 15px, `#6B6B6B`
- Email input: filled style, `EnvelopeSimple` icon (20px, `#6B6B6B`)
- "Send Reset Link" button — green pill, 52px
- "Back to Login" — 14px, `#6B6B6B`, text link below button

**AI Prompt:**
```typescript
/*
TASK: Redesign ForgotPasswordScreen — VISUAL ONLY
DO NOT CHANGE: password reset API call, email validation logic, navigation
ONLY CHANGE: StyleSheet, add EnvelopeSimple from phosphor-react-native

import { EnvelopeSimple } from 'phosphor-react-native';

Apply same filled input style as LoginScreen email field.
Heading: fontSize 24, fontWeight '600'
Submit button: backgroundColor '#5DBB8E', borderRadius 26, height 52
*/
// filepath: src/screens/auth/ForgotPasswordScreen.tsx
```

---

##### Screen 6 of 7: Reset Password Screen
**File:** `src/screens/auth/ResetPasswordScreen.tsx` | **Duration:** 2h

**Design Specs:**
- Heading: "Reset Password" — 24px semibold
- New password input: filled style, `Lock` icon left, `Eye`/`EyeSlash` toggle right
- Confirm new password: same style
- "Set New Password" button — green pill, 52px

**AI Prompt:**
```typescript
/*
TASK: Redesign ResetPasswordScreen — VISUAL ONLY
DO NOT CHANGE: password update logic, password match validation, supabase.auth.updateUser(), navigation
ONLY CHANGE: StyleSheet, swap icons → Phosphor

import { Lock, Eye, EyeSlash } from 'phosphor-react-native';
Apply same filled input pattern as LoginScreen password fields.
*/
// filepath: src/screens/auth/ResetPasswordScreen.tsx
```

---

##### Screen 7 of 7: Suspended Account Screen
**File:** `src/screens/auth/SuspendedAccountScreen.tsx` | **Duration:** 2h

**Design Specs:**
- Centered layout
- `WarningCircle` icon — 64px, `#E85D75`, centered at top
- Heading: "Account Suspended" — 24px semibold, `#1A1A1A`
- Message body — 15px, `#6B6B6B`, centered, `lineHeight 22`
- "Contact Support" button — green pill, 52px (the **only** interactive element — no login/signup links)

**AI Prompt:**
```typescript
/*
TASK: Redesign SuspendedAccountScreen — VISUAL ONLY
DO NOT CHANGE: contact support action handler, navigation logic
ONLY CHANGE: StyleSheet, add WarningCircle from phosphor-react-native

import { WarningCircle } from 'phosphor-react-native';

DESIGN SPEC:
container: { flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }
icon: WarningCircle size={64} color="#E85D75" weight="regular"
heading: { fontSize: 24, fontWeight: '600', color: '#1A1A1A', marginTop: 16, textAlign: 'center' }
message: { fontSize: 15, color: '#6B6B6B', textAlign: 'center', lineHeight: 22, marginTop: 8 }
button: { width: '100%', height: 52, backgroundColor: '#5DBB8E', borderRadius: 26, marginTop: 32 }

⚠️ NO login link, NO signup link — this screen has ONE button only.
*/
// filepath: src/screens/auth/SuspendedAccountScreen.tsx
```

---

#### ✅ Acceptance Criteria — FLOW-01 (Visual Only)

- [ ] All 7 screens use `#FFFFFF` white background — no gray or off-white
- [ ] Primary buttons: `height: 52`, `borderRadius: 26` (pill shape), `backgroundColor: '#5DBB8E'`
- [ ] All text inputs: `backgroundColor: '#F0F0F0'`, `borderRadius: 12`, `height: 52`, **no `borderWidth`**
- [ ] All icons are from `phosphor-react-native` — zero remaining Ionicons/MaterialIcons imports
- [ ] `EnvelopeSimple` (20px) appears in email inputs on Login, Signup, Forgot Password screens
- [ ] `Lock`, `Eye`, `EyeSlash` (20px) appear correctly in all password fields
- [ ] "Forgot password?" link color is `#5DBB8E` green
- [ ] Social login buttons are exactly 50×50px circles, white background, `#E0E0E0` border
- [ ] `WarningCircle` is 64px, `#E85D75` on SuspendedAccountScreen
- [ ] SuspendedAccountScreen has **only one button** — no login or signup navigation links visible
- [ ] Input labels are 13px, uppercase, `#6B6B6B`
- [ ] Screen horizontal padding is 24px on all 7 screens

---
---

### TASK FLOW-02: Profiles & Onboarding

**Duration:** 18 hours  
**Priority:** P0 (Critical) — User retention driver  
**Screens:** 5 total  
**Asset Dependencies:** `DotsThree`, `CaretRight`, `User`, `Camera`, `CalendarBlank` + **4 Storyset illustration files**

---

> **🚫 FROZEN — UI REDESIGN SCOPE ONLY**
>
> This task is **visual redesign only**. Do NOT change any of the following in any screen within this task:
> - **Supabase / API calls** — all `supabase.*`, profile upsert, and storage upload calls stay exactly as-is
> - **Form validation** — all validation rules, required fields, DOB age checks, and error text stay exactly as-is
> - **Navigation / routing** — screen names, navigator structure, and all `navigation.navigate()` calls stay exactly as-is
> - **State management** — all `useState`, Redux, and Context logic stays exactly as-is
> - **Business logic** — carousel slide logic, onboarding step tracking, any non-UI function stays exactly as-is
> - **Data models** — TypeScript interfaces, prop types, and DB schema stay exactly as-is
>
> **Only modify:** `StyleSheet` values · icon imports → Phosphor · layout JSX · colors · font sizes · spacing · illustration `<Image>` source props (add illustrations where missing)

---

#### Description
Redesign the post-signup onboarding and profile setup screens. This flow is the first experience after account creation. The Feature Highlights carousel is the primary place where Storyset illustrations are used — it introduces app features in a clean, visual format. Profile screens adopt the same filled-input design language as auth screens.

#### Scope — Files to Modify

| # | Screen | File | Change Type |
|---|--------|------|-------------|
| 1 | Welcome Screen | `src/screens/onboarding/WelcomeScreen.tsx` | Restyle only |
| 2 | Profile Completion | `src/screens/onboarding/ProfileCompletionScreen.tsx` | Restyle only |
| 3 | Feature Highlights Carousel | `src/screens/onboarding/FeatureHighlightsScreen.tsx` | Restyle + add illustrations |
| 4 | Onboarding Carousel (Trading Ed) | `src/screens/onboarding/OnboardingScreen.tsx` | Restyle only |
| 5 | Profile Setup | `src/screens/profile/ProfileSetupScreen.tsx` | Restyle only |

---

#### Per-Screen Design Specs & AI Prompts

##### Screen 1 of 5: Welcome Screen
**File:** `src/screens/onboarding/WelcomeScreen.tsx` | **Duration:** 2h

**Design Specs:**
- White background, centered vertical layout
- Headline: "Welcome, [Name]!" — 28px, semibold, `#1A1A1A`, centered
- Subheading: "Let's set up your profile" — 15px, `#6B6B6B`, centered
- Primary CTA: "Get Started" — green pill, 52px, full width

**AI Prompt:**
```typescript
/*
TASK: Redesign WelcomeScreen — VISUAL ONLY
DO NOT CHANGE: user name data binding, navigation call, any logic
ONLY CHANGE: StyleSheet, layout

Apply same centered layout and pill button style as LandingScreen.
Heading: fontSize 28, fontWeight '600', color '#1A1A1A'
Subheading: fontSize 15, color '#6B6B6B'
Button: backgroundColor '#5DBB8E', borderRadius 26, height 52, full width
*/
// filepath: src/screens/onboarding/WelcomeScreen.tsx
```

---

##### Screen 2 of 5: Profile Completion Screen
**File:** `src/screens/onboarding/ProfileCompletionScreen.tsx` | **Duration:** 4h

**Design Specs:**
- Avatar upload area: circular crop container, 120px diameter, `#F0F0F0` placeholder, `Camera` icon (20px, `#6B6B6B`) centered
- Display name input: filled style, label "DISPLAY NAME", `User` icon left (20px)
- Date of birth input: filled style, label "DATE OF BIRTH", `CalendarBlank` icon left (20px)
- "Save Profile" button — green pill, 52px
- Skip link (if present): 14px, `#6B6B6B`

**AI Prompt:**
```typescript
/*
TASK: Redesign ProfileCompletionScreen — VISUAL ONLY
DO NOT CHANGE: image picker logic, supabase storage upload, profile upsert, DOB validation, navigation
ONLY CHANGE: StyleSheet, swap icons → Phosphor

import { User, Camera, CalendarBlank } from 'phosphor-react-native';

AVATAR AREA (visual container only — do not change image picker handler):
avatarContainer: {
  width: 120, height: 120, borderRadius: 60,
  backgroundColor: '#F0F0F0',
  justifyContent: 'center', alignItems: 'center',
  alignSelf: 'center', marginBottom: 24,
}
// Camera icon centered inside when no photo selected

INPUTS: Same filled style as auth screens (#F0F0F0, borderRadius 12, height 52)
SAVE BUTTON: backgroundColor '#5DBB8E', borderRadius 26, height 52, width '100%'
*/
// filepath: src/screens/onboarding/ProfileCompletionScreen.tsx
```

---

##### Screen 3 of 5: Feature Highlights Carousel
**File:** `src/screens/onboarding/FeatureHighlightsScreen.tsx` | **Duration:** 5h

**Asset Dependencies (CRITICAL):**  
⚠️ These 4 files must exist in `src/assets/illustrations/` before implementation:
- `onboarding-sp-earning.png`
- `onboarding-safe-trading.png`
- `onboarding-marketplace.png`
- `onboarding-sustainable.png`

If files are missing: use 280×210 colored `<View>` placeholders with text labels.

**Design Specs:**
- Horizontal swipeable carousel (4 slides)
- Each slide: illustration (280×210pt), heading (20px semibold, centered), description (15px `#6B6B6B`, centered)
- Pagination dots bottom: active `#5DBB8E` (8px circle), inactive `#E0E0E0` (8px circle)
- "Next" button for slides 1–3, "Get Started" on slide 4 — green pill, 52px, full width

**AI Prompt:**
```typescript
/*
TASK: Redesign FeatureHighlightsScreen — VISUAL ONLY
DO NOT CHANGE: carousel navigation logic, slide index state, onComplete navigation, any non-UI logic
ONLY CHANGE: StyleSheet, add illustration Image imports, swap icons → Phosphor

import { CaretRight } from 'phosphor-react-native';

ILLUSTRATION IMPORTS:
const slides = [
  { id: '1', title: 'Earn Swap Points', description: 'Get rewarded with SP on every sale to use on future purchases', image: require('@/assets/illustrations/onboarding-sp-earning.png') },
  { id: '2', title: 'Safe Local Trading', description: 'Connect with families in your neighborhood for secure, verified trades', image: require('@/assets/illustrations/onboarding-safe-trading.png') },
  { id: '3', title: 'Kids Marketplace', description: 'Browse gently used clothes, toys, books, and gear for kids of all ages', image: require('@/assets/illustrations/onboarding-marketplace.png') },
  { id: '4', title: 'Sustainable Reuse', description: 'Give kids items a second life and reduce waste together', image: require('@/assets/illustrations/onboarding-sustainable.png') },
];

SLIDE LAYOUT:
slide: { width: screenWidth, alignItems: 'center', paddingHorizontal: 24 }
illustration: { width: 280, height: 210, marginBottom: 24 }
title: { fontSize: 20, fontWeight: '600', color: '#1A1A1A', textAlign: 'center', marginBottom: 8 }
description: { fontSize: 15, color: '#6B6B6B', textAlign: 'center', lineHeight: 22 }

PAGINATION DOTS:
dot: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 4 }
dotActive: { backgroundColor: '#5DBB8E' }
dotInactive: { backgroundColor: '#E0E0E0' }

NEXT BUTTON: backgroundColor '#5DBB8E', borderRadius 26, height 52, marginHorizontal 24
*/
// filepath: src/screens/onboarding/FeatureHighlightsScreen.tsx
```

---

##### Screen 4 of 5: Onboarding Carousel (Trading Education)
**File:** `src/screens/onboarding/OnboardingScreen.tsx` | **Duration:** 4h

**Design Specs:**
- Same carousel structure as Feature Highlights
- 4 slides: How to sell · How to buy · SP rewards · Safety features
- Use Phosphor icons (64px, `#5DBB8E`) as slide visuals instead of illustrations
- Same pagination dots and Next/Get Started button pattern

**AI Prompt:**
```typescript
/*
TASK: Redesign OnboardingScreen (trading education) — VISUAL ONLY
DO NOT CHANGE: carousel step logic, navigation on completion, any non-UI logic
ONLY CHANGE: StyleSheet, slide content visuals → Phosphor icons as slide heroes

import { Storefront, ShoppingCart, Coins, ShieldCheck, CaretRight } from 'phosphor-react-native';

SLIDE ICONS (use large icons as slide visuals):
Slide 1 (How to sell): Storefront size={80} color="#5DBB8E"
Slide 2 (How to buy): ShoppingCart size={80} color="#5DBB8E"
Slide 3 (SP rewards): Coins size={80} color="#F59E0B"
Slide 4 (Safety): ShieldCheck size={80} color="#5DBB8E"

Apply same dot + button pattern as FeatureHighlightsScreen.
*/
// filepath: src/screens/onboarding/OnboardingScreen.tsx
```

---

##### Screen 5 of 5: Profile Setup Screen
**File:** `src/screens/profile/ProfileSetupScreen.tsx` | **Duration:** 3h

**Design Specs:**
- Post-OTP variant of Profile Completion
- Same avatar upload, display name, and DOB fields
- Same Phosphor icons: `User`, `Camera`, `CalendarBlank`
- "Complete Setup" button — green pill, 52px

**AI Prompt:**
```typescript
/*
TASK: Redesign ProfileSetupScreen — VISUAL ONLY
DO NOT CHANGE: profile update API call, validation, navigation
ONLY CHANGE: StyleSheet, icons → Phosphor

Mirror ProfileCompletionScreen's visual design exactly.
import { User, Camera, CalendarBlank } from 'phosphor-react-native';
*/
// filepath: src/screens/profile/ProfileSetupScreen.tsx
```

---

#### ✅ Acceptance Criteria — FLOW-02 (Visual Only)

- [ ] WelcomeScreen headline is 28px semibold, centered, on white background
- [ ] Avatar upload area is circular (120px), `#F0F0F0` background, `Camera` icon centered
- [ ] `User`, `Camera`, `CalendarBlank` icons (Phosphor) appear on profile input screens
- [ ] FeatureHighlightsScreen has exactly 4 slides with illustrations (or labeled placeholders)
- [ ] Carousel pagination dots: active `#5DBB8E`, inactive `#E0E0E0`, 8px circles
- [ ] Slide 4 shows "Get Started" button; slides 1–3 show "Next" with `CaretRight` icon
- [ ] Button on slide 4 navigates correctly (existing nav call preserved)
- [ ] OnboardingScreen uses large Phosphor icons (80px) as slide hero visuals — no placeholder boxes
- [ ] All input fields on profile screens use filled style (`#F0F0F0`, 12px radius, no border)
- [ ] All primary buttons are green pill (52px, `borderRadius: 26`)

---
---

### TASK FLOW-03: Node / ZIP Gating

**Duration:** 6 hours  
**Priority:** P1 (High) — Location-based access control  
**Screens:** 2 total  
**Asset Dependencies:** `MapPin`, `Crosshair`, `Buildings`, `MapPinLine`

---

> **🚫 FROZEN — UI REDESIGN SCOPE ONLY**
>
> This task is **visual redesign only**. Do NOT change any of the following:
> - **Supabase / API calls** — node lookup, ZIP validation, geolocation API calls stay exactly as-is
> - **Form validation** — ZIP format check (5 digits), radius min/max values, node availability logic stay exactly as-is
> - **Navigation / routing** — all `navigation.navigate()` calls stay exactly as-is
> - **State management** — all state logic, location permission handling stay exactly as-is
> - **Business logic** — node filtering, radius calculations, any non-UI function stays exactly as-is
> - **Data models** — TypeScript interfaces, prop types stay exactly as-is
>
> **Only modify:** `StyleSheet` values · icon imports → Phosphor · layout JSX · colors · font sizes · spacing

---

#### Description
Redesign the 2 location-gating screens that allow users to set their ZIP code and select a local node (neighborhood/community group). These are critical to the app's local marketplace model — the UI must guide users clearly without friction.

#### Scope — Files to Modify

| # | Screen | File | Change Type |
|---|--------|------|-------------|
| 1 | Location Picker | `src/screens/onboarding/LocationPickerScreen.tsx` | Restyle only |
| 2 | Node Selection | `src/screens/onboarding/NodeSelectionScreen.tsx` | Restyle only |

---

#### Per-Screen Design Specs & AI Prompts

##### Screen 1 of 2: Location Picker Screen
**File:** `src/screens/onboarding/LocationPickerScreen.tsx` | **Duration:** 3h

**Design Specs:**
- Heading: "Set Your Location" — 24px semibold
- Subtext: "We'll show you items available in your area" — 15px, `#6B6B6B`
- ZIP code input: filled style, `MapPin` icon left (20px, `#5DBB8E`), label "ZIP CODE" (13px uppercase)
- "Use My Location" button: secondary outlined style (border `#5DBB8E`, 48px, pill), `Crosshair` icon left (16px)
- Radius slider row: label "SEARCH RADIUS", value chip showing "XX miles" in green
- "Continue" button — green pill, 52px, sticky bottom or below form

**AI Prompt:**
```typescript
/*
TASK: Redesign LocationPickerScreen — VISUAL ONLY
DO NOT CHANGE: geolocation call, ZIP validation logic, radius state, navigation
ONLY CHANGE: StyleSheet, swap icons → Phosphor

import { MapPin, Crosshair } from 'phosphor-react-native';

ZIP INPUT: backgroundColor '#F0F0F0', borderRadius 12, height 52, MapPin icon left (color '#5DBB8E')
USE LOCATION BUTTON (secondary style):
  height 48, borderRadius 24, borderWidth 1, borderColor '#5DBB8E', backgroundColor 'transparent'
  Crosshair icon left (size 16, color '#5DBB8E')
RADIUS VALUE CHIP: backgroundColor '#E8F5F0' (green tint), borderRadius 12, paddingHorizontal 12, color '#5DBB8E'
CONTINUE BUTTON: backgroundColor '#5DBB8E', borderRadius 26, height 52, full width
*/
// filepath: src/screens/onboarding/LocationPickerScreen.tsx
```

---

##### Screen 2 of 2: Node Selection Screen
**File:** `src/screens/onboarding/NodeSelectionScreen.tsx` | **Duration:** 3h

**Design Specs:**
- Heading: "Choose Your Community" — 24px semibold
- Subtext: "Select the neighborhood you'll trade in" — 15px, `#6B6B6B`
- Node list cards: white bg, 12px radius, 16px padding, subtle shadow (`elevation: 2`)
  - `Buildings` icon (24px, `#5DBB8E`) left
  - Node name (16px semibold, `#1A1A1A`) + distance (13px, `#6B6B6B`) + member count (13px, `#6B6B6B`)
  - Selected state: green left border (3px, `#5DBB8E`), light green bg tint (`#E8F5F0`)
- "Continue" button — green pill, 52px, sticky bottom

**AI Prompt:**
```typescript
/*
TASK: Redesign NodeSelectionScreen — VISUAL ONLY
DO NOT CHANGE: node data fetching, node selection state, navigation
ONLY CHANGE: StyleSheet, swap icons → Phosphor

import { Buildings, MapPinLine } from 'phosphor-react-native';

NODE CARD:
nodeCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4 }
nodeCardSelected: { borderLeftWidth: 3, borderLeftColor: '#5DBB8E', backgroundColor: '#E8F5F0' }
nodeName: { fontSize: 16, fontWeight: '600', color: '#1A1A1A' }
nodeMeta: { fontSize: 13, color: '#6B6B6B' }

CONTINUE BUTTON: backgroundColor '#5DBB8E', borderRadius 26, height 52, full width
*/
// filepath: src/screens/onboarding/NodeSelectionScreen.tsx
```

---

#### ✅ Acceptance Criteria — FLOW-03 (Visual Only)

- [ ] ZIP input uses filled style (`#F0F0F0`, 12px radius, no border), `MapPin` icon in `#5DBB8E`
- [ ] "Use My Location" button is secondary style (outlined, `#5DBB8E` border, transparent bg)
- [ ] `Crosshair` icon (Phosphor) appears on the "Use My Location" button
- [ ] Radius value displays in a green chip/badge (`#5DBB8E` text, `#E8F5F0` background)
- [ ] Node cards have white background, 12px radius, subtle shadow
- [ ] `Buildings` icon (24px, `#5DBB8E`) appears on each node card
- [ ] Selected node card has 3px left border in `#5DBB8E` and light green background `#E8F5F0`
- [ ] "Continue" button is green pill (52px, `borderRadius: 26`) on both screens

---
---

### TASK FLOW-04: Listing Management

**Duration:** 27 hours  
**Priority:** P0 (Critical) — Seller activation  
**Screens:** 5 total  
**Asset Dependencies:** `Camera`, `Image`, `Plus`, `X`, `Coins`, `Tag`, `CheckSquare`, `Square`, `Storefront`, `PencilSimple`, `Trash`, `Eye`, `DotsThree`, `Package`, `ShieldWarning`, `WarningCircle`

---

> **🚫 FROZEN — UI REDESIGN SCOPE ONLY**
>
> This task is **visual redesign only**. Do NOT change any of the following:
> - **Supabase / API calls** — all listing create/update/delete/fetch calls stay exactly as-is
> - **Form validation** — all field validation rules (title length, price format, category required, etc.) stay exactly as-is
> - **Navigation / routing** — all `navigation.navigate()` calls stay exactly as-is
> - **State management** — all `useState`, form state, multi-step wizard logic stays exactly as-is
> - **Business logic** — SP earn calculations, CPSC safety check triggers, publish logic, any non-UI function stays exactly as-is
> - **Image picker / camera** — all `expo-image-picker`, camera permission, and upload logic stays exactly as-is
> - **Data models** — TypeScript interfaces, prop types stay exactly as-is
>
> **Only modify:** `StyleSheet` values · icon imports → Phosphor · layout JSX · colors · font sizes · spacing

---

#### Description
Redesign the 5 listing management screens. The Create Listing screen is photo-first — the photo upload area is the most prominent element. My Listings shows a list with status badges. The Safety Review screen uses the error color (`#E85D75`) to communicate a serious CPSC recall issue clearly.

#### Scope — Files to Modify

| # | Screen | File | Change Type |
|---|--------|------|-------------|
| 1 | Create Listing | `src/screens/ItemCreateScreen.tsx` | Restyle only |
| 2 | Bulk Listing Create | `src/screens/listing/BulkListingCreateScreen.tsx` | Restyle only |
| 3 | Edit Listing | `src/screens/listing/EditListingScreen.tsx` | Restyle only |
| 4 | My Listings | `src/screens/listing/MyListingsScreen.tsx` | Restyle only |
| 5 | Listing Safety Review | `src/screens/listing/ListingSafetyReviewScreen.tsx` | Restyle only |

---

#### Per-Screen Design Specs & AI Prompts

##### Screen 1 of 5: Create Listing Screen (Photo-First)
**File:** `src/screens/ItemCreateScreen.tsx` | **Duration:** 8h

**Design Specs:**
- Photo upload grid: prominent, full-width at top, 2×3 max, dashed border `#E0E0E0` on empty slots
  - Empty slot: `Camera` icon (32px, `#6B6B6B`) centered, 1:1 aspect ratio
  - Filled slot: image thumbnail, `X` icon (16px, white on dark overlay) top-right to remove
- SP earn preview badge: `Coins` icon (16px, `#F59E0B`) + "Earn ~250 SP" text, gold bg `#FEF3C7`, 8px radius
- All form inputs: filled style (`#F0F0F0`, 12px radius, 52px)
- Category selector: `Tag` icon left (20px), dropdown-style filled input
- Condition selector: `CheckSquare`/`Square` icons for radio-style selection chips
- "Publish Listing" button — green pill, 52px, sticky bottom

**AI Prompt:**
```typescript
/*
TASK: Redesign ItemCreateScreen — VISUAL ONLY
DO NOT CHANGE: image picker handler, supabase listing insert, SP calculation, form validation, navigation
ONLY CHANGE: StyleSheet, swap icons → Phosphor, restyle photo grid and form inputs

import { Camera, Image, Plus, X, Coins, Tag, CheckSquare, Square } from 'phosphor-react-native';

PHOTO GRID EMPTY SLOT:
photoSlot: { aspectRatio: 1, backgroundColor: '#F0F0F0', borderRadius: 8, borderWidth: 1, borderColor: '#E0E0E0', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' }
// Camera icon centered

SP EARN BADGE:
spBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', gap: 4 }
spBadgeText: { fontSize: 13, color: '#F59E0B', fontWeight: '500' }

FORM INPUTS: Same filled style as auth screens
PUBLISH BUTTON: backgroundColor '#5DBB8E', borderRadius 26, height 52, width '100%'
*/
// filepath: src/screens/ItemCreateScreen.tsx
```

---

##### Screen 2 of 5: Bulk Listing Create Screen
**File:** `src/screens/listing/BulkListingCreateScreen.tsx` | **Duration:** 6h

**Design Specs:**
- Same photo-first grid as Create Listing
- Empty state (no photos yet): `Package` icon (64px, `#E0E0E0`) centered, "Add photos to get started" (15px, `#6B6B6B`)
- Batch form fields mirror single listing form style

**AI Prompt:**
```typescript
/*
TASK: Redesign BulkListingCreateScreen — VISUAL ONLY
DO NOT CHANGE: bulk upload logic, batch insert, navigation
ONLY CHANGE: StyleSheet, icons → Phosphor

import { Image, Package } from 'phosphor-react-native';

EMPTY STATE:
Package size={64} color="#E0E0E0" — centered, with "Add photos to get started" below
Apply same photo grid and form styles as ItemCreateScreen.
*/
// filepath: src/screens/listing/BulkListingCreateScreen.tsx
```

---

##### Screen 3 of 5: Edit Listing Screen
**File:** `src/screens/listing/EditListingScreen.tsx` | **Duration:** 4h

**Design Specs:**
- Identical to Create Listing but pre-populated with existing data
- "Save Changes" button — green pill, 52px, sticky bottom
- "Delete Listing" — red text link (14px, `#E85D75`) below save button

**AI Prompt:**
```typescript
/*
TASK: Redesign EditListingScreen — VISUAL ONLY
DO NOT CHANGE: pre-population logic, listing update call, delete handler, navigation
ONLY CHANGE: StyleSheet, icons → Phosphor

Mirror ItemCreateScreen styles exactly.
DELETE LINK: fontSize 14, color '#E85D75', textAlign 'center', paddingVertical 12
SAVE BUTTON: backgroundColor '#5DBB8E', borderRadius 26, height 52
*/
// filepath: src/screens/listing/EditListingScreen.tsx
```

---

##### Screen 4 of 5: My Listings Screen
**File:** `src/screens/listing/MyListingsScreen.tsx` | **Duration:** 5h

**Design Specs:**
- Header: `Storefront` icon (24px, `#5DBB8E`) + "My Listings" title
- Listing rows (list view, not grid):
  - Thumbnail: 72×72px, 8px radius
  - Title: 16px semibold, `#1A1A1A`, 2 lines max
  - Price: 15px, `#1A1A1A`
  - Status badge: pill chip, colored by status (see below)
  - Actions: `PencilSimple` (edit), `Trash` (delete), `DotsThree` (more) — 20px each
- Status badge colors: Active = `#E8F5F0` bg + `#5DBB8E` text · Sold = `#F5F5F5` + `#6B6B6B` · Expired = `#FEF9C3` + `#CA8A04` · Pending = `#FEF3C7` + `#D97706`
- Empty state: `Storefront` (64px, `#E0E0E0`) + "No listings yet" + "Create Listing" green pill CTA

**AI Prompt:**
```typescript
/*
TASK: Redesign MyListingsScreen — VISUAL ONLY
DO NOT CHANGE: listings data fetch, delete handler, navigation to edit
ONLY CHANGE: StyleSheet, icons → Phosphor, status badge colors

import { Storefront, PencilSimple, Trash, DotsThree } from 'phosphor-react-native';

STATUS BADGE STYLES:
badgeActive: { backgroundColor: '#E8F5F0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }
badgeActiveText: { fontSize: 12, color: '#5DBB8E', fontWeight: '500' }
badgeSold: { backgroundColor: '#F5F5F5' } — text color '#6B6B6B'
badgeExpired: { backgroundColor: '#FEF9C3' } — text color '#CA8A04'
badgePending: { backgroundColor: '#FEF3C7' } — text color '#D97706'

LISTING ROW:
thumbnail: { width: 72, height: 72, borderRadius: 8 }
EMPTY STATE: Storefront size={64} color="#E0E0E0" + green pill CTA
*/
// filepath: src/screens/listing/MyListingsScreen.tsx
```

---

##### Screen 5 of 5: Listing Safety Review Screen
**File:** `src/screens/listing/ListingSafetyReviewScreen.tsx` | **Duration:** 4h

**Design Specs:**
- Alert banner (full width): `#FEE2E2` red tint bg, `#E85D75` text, `ShieldWarning` icon (20px) left
- Item preview card: thumbnail, title, price (read-only)
- Recall details section: ID, reason, remediation URL (tappable link, `#5DBB8E`)
- "Remove Listing" button — danger red pill (`#E85D75`, `borderRadius: 26`, 52px)
- "Appeal This Decision" — secondary outlined button (border `#6B6B6B`, 48px, pill) below

**AI Prompt:**
```typescript
/*
TASK: Redesign ListingSafetyReviewScreen — VISUAL ONLY
DO NOT CHANGE: remove listing API call, appeal navigation, recall data fetching
ONLY CHANGE: StyleSheet, swap icons → Phosphor

import { ShieldWarning, WarningCircle } from 'phosphor-react-native';

ALERT BANNER:
alertBanner: { backgroundColor: '#FEE2E2', borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 }
alertText: { fontSize: 14, color: '#E85D75', flex: 1 }
ShieldWarning size={20} color="#E85D75"

REMOVE BUTTON (danger):
dangerButton: { backgroundColor: '#E85D75', borderRadius: 26, height: 52, width: '100%' }
dangerButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' }

APPEAL BUTTON (secondary):
secondaryButton: { borderWidth: 1, borderColor: '#6B6B6B', borderRadius: 24, height: 48, width: '100%', marginTop: 12 }
*/
// filepath: src/screens/listing/ListingSafetyReviewScreen.tsx
```

---

#### ✅ Acceptance Criteria — FLOW-04 (Visual Only)

- [ ] Photo upload empty slots use `Camera` icon (32px, `#6B6B6B`), dashed border, 1:1 aspect ratio
- [ ] SP earn preview badge is gold (`#FEF3C7` background, `#F59E0B` text), `Coins` icon left
- [ ] All form inputs are filled style (`#F0F0F0`, 12px radius, no border)
- [ ] "Publish Listing" / "Save Changes" buttons are green pill (52px, `borderRadius: 26`)
- [ ] `Storefront` icon (24px, `#5DBB8E`) appears in MyListings header
- [ ] Status badges on My Listings use correct color pairs: Active=green, Sold=gray, Expired=yellow, Pending=orange
- [ ] `PencilSimple`, `Trash`, `DotsThree` (Phosphor, 20px) appear as action icons on listing rows
- [ ] My Listings empty state shows `Storefront` (64px, `#E0E0E0`)
- [ ] Safety Review alert banner has `#FEE2E2` background and `ShieldWarning` Phosphor icon
- [ ] "Remove Listing" button is `#E85D75` red pill (52px) — NOT green
- [ ] "Appeal" button is secondary outlined style (not filled)

---
---

### TASK FLOW-06: Discovery & Search

**Duration:** 24 hours  
**Priority:** P0 (Critical) — Core discovery loop  
**Screens:** 3 screens + 1 modal component  
**Asset Dependencies:** `MagnifyingGlass`, `FunnelSimple`, `SortAscending`, `Heart`, `HeartFill`, `X`, `Share`, `MapPin`, `Coins`, `CheckCircle`, `ShoppingCart`, `SlidersHorizontal`, `CheckSquare`, `Square` + category icons (`Tshirt`, `Sneaker`, `Backpack`, `GameController`, `BookOpen`)

---

> **🚫 FROZEN — UI REDESIGN SCOPE ONLY**
>
> This task is **visual redesign only**. Do NOT change any of the following:
> - **Supabase / API calls** — all item search, filter, favorite, and fetch calls stay exactly as-is
> - **Form validation** — all search/filter validation stays exactly as-is
> - **Navigation / routing** — all `navigation.navigate()` calls stay exactly as-is
> - **State management** — all search state, filter state, pagination state stays exactly as-is
> - **Business logic** — search ranking, filter logic, distance calculations, favorite toggle logic stays exactly as-is
> - **Data models** — TypeScript interfaces, prop types stay exactly as-is
>
> **Only modify:** `StyleSheet` values · icon imports → Phosphor · layout JSX · colors · font sizes · spacing

---

#### Description
Redesign the 3 discovery screens and the filter modal. The Discover screen is the app's home for browsing — it must be fast-feeling, clean, and scannable. The 2-column item grid uses the `ItemCard` component. The SearchFilterModal is a bottom sheet with 8 filter sections.

#### Scope — Files to Modify

| # | Screen | File | Change Type |
|---|--------|------|-------------|
| 1 | Discover Screen | `src/screens/home/DiscoverScreen.tsx` | Restyle only |
| 2 | Category Browse | `src/screens/home/CategoryBrowseScreen.tsx` | Restyle only |
| 3 | Item Detail | `src/screens/home/ItemDetailScreen.tsx` | Restyle only |
| 4 | Search Filter Modal | `src/components/molecules/SearchFilterModal.tsx` | Restyle only |

---

#### Per-Screen Design Specs & AI Prompts

##### Screen 1 of 4: Discover Screen
**File:** `src/screens/home/DiscoverScreen.tsx` | **Duration:** 8h

**Design Specs:**
- Search bar: pill-shaped, filled style, 48px height, `MagnifyingGlass` icon left (20px, `#6B6B6B`), `X` icon right (16px, only when text present)
- Filter button: `FunnelSimple` icon (20px), circular button (44×44px), green badge with count when active
- Sort button: `SortAscending` icon (20px), circular button (44×44px)
- Active filter chips: horizontal scroll row, pill chips (green outline), `X` icon to remove each
- Item grid: `FlatList numColumns={2}`, 12px gap, 16px padding
- Empty state: `MagnifyingGlass` (64px, `#E0E0E0`) + "No items found" text

**AI Prompt:**
```typescript
/*
TASK: Redesign DiscoverScreen — VISUAL ONLY
DO NOT CHANGE: search handler, filter apply logic, pagination, favorites API, navigation
ONLY CHANGE: StyleSheet, icons → Phosphor, layout

import { MagnifyingGlass, FunnelSimple, SortAscending, Heart, X } from 'phosphor-react-native';

SEARCH BAR:
searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0F0', borderRadius: 24, height: 48, paddingHorizontal: 16, flex: 1 }
MagnifyingGlass size={20} color="#6B6B6B" — left of input

FILTER BUTTON (icon only, with badge):
filterBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center', marginLeft: 8 }
filterBadge: { position: 'absolute', top: 0, right: 0, width: 16, height: 16, borderRadius: 8, backgroundColor: '#5DBB8E' }

FILTER CHIPS:
chip: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16, borderWidth: 1, borderColor: '#5DBB8E', flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 8 }
chipText: { fontSize: 13, color: '#5DBB8E' }

ITEM GRID: FlatList numColumns={2}, columnWrapperStyle={{ gap: 12 }}, contentContainerStyle={{ padding: 16, gap: 12 }}
*/
// filepath: src/screens/home/DiscoverScreen.tsx
// TODO: Import ItemCard component (from COMPONENT-003)
// TODO: Import SearchFilterModal (from COMPONENT / this task Screen 4)
```

---

##### Screen 2 of 4: Category Browse Screen
**File:** `src/screens/home/CategoryBrowseScreen.tsx` | **Duration:** 4h

**Design Specs:**
- Category header row: category icon (32px, `#5DBB8E`) + category name (20px semibold)
- Reuse Discover Screen's item grid layout below
- Breadcrumb: "Home > [Category]" — 13px, `#6B6B6B`, with `CaretRight` separators (12px)

**AI Prompt:**
```typescript
/*
TASK: Redesign CategoryBrowseScreen — VISUAL ONLY
DO NOT CHANGE: category filter query, navigation, pagination
ONLY CHANGE: StyleSheet, icons → Phosphor (category icon from implementation-guide.md)

import { Tshirt, Sneaker, Backpack, GameController, BookOpen, CaretRight } from 'phosphor-react-native';

CATEGORY HEADER:
categoryIcon: size 32, color '#5DBB8E'
categoryName: { fontSize: 20, fontWeight: '600', color: '#1A1A1A', marginLeft: 12 }

BREADCRUMB:
breadcrumb: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 }
breadcrumbText: { fontSize: 13, color: '#6B6B6B' }
CaretRight size={12} color="#6B6B6B"

Reuse DiscoverScreen's grid layout for the item list below.
*/
// filepath: src/screens/home/CategoryBrowseScreen.tsx
```

---

##### Screen 3 of 4: Item Detail Screen
**File:** `src/screens/home/ItemDetailScreen.tsx` | **Duration:** 6h

**Design Specs:**
- Image carousel: full-width, swipeable, pagination dots (active `#5DBB8E`, inactive `#E0E0E0`)
- `Heart`/`HeartFill` (24px) and `Share` (24px, `#1A1A1A`) — absolute top-right overlay on images
- Title: 20px semibold, `#1A1A1A`
- Price row: price (24px semibold) + SP earn badge (`Coins` 16px `#F59E0B` + "Earn 250 SP" gold chip)
- Seller card: avatar (40px circle), name (15px semibold), `ShieldCheck` verified badge (16px `#5DBB8E`), star rating (`Star` 14px `#F59E0B`)
- Condition/size/brand tags: pill chips, `#F0F0F0` bg, `#6B6B6B` text, 8px radius
- Location row: `MapPin` (14px, `#6B6B6B`) + "2.3 mi away"
- "Buy Now" — green pill, 52px, full width, **sticky bottom**
- "Add to Cart" — secondary outlined (border `#5DBB8E`), 48px, pill, above Buy Now

**AI Prompt:**
```typescript
/*
TASK: Redesign ItemDetailScreen — VISUAL ONLY
DO NOT CHANGE: buy now handler, add to cart handler, favorite toggle API call, seller navigation, navigation params
ONLY CHANGE: StyleSheet, icons → Phosphor, layout

import { Heart, HeartFill, Share, MapPin, Coins, CheckCircle, ShoppingCart, ShieldCheck, Star } from 'phosphor-react-native';

IMAGE OVERLAY BUTTONS (absolute positioned, top-right):
overlayActions: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', gap: 8 }
overlayBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center' }

SP EARN BADGE (same as CreateListing):
spChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, gap: 4 }

CONDITION TAGS:
tag: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#F0F0F0', borderRadius: 8, marginRight: 6 }
tagText: { fontSize: 13, color: '#6B6B6B' }

STICKY BOTTOM BAR:
stickyBar: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F0F0F0' }
BUY NOW: backgroundColor '#5DBB8E', borderRadius 26, height 52, full width, marginBottom 8
ADD TO CART: borderWidth 1, borderColor '#5DBB8E', borderRadius 24, height 48, full width
*/
// filepath: src/screens/home/ItemDetailScreen.tsx
```

---

##### Screen 4 of 4: Search Filter Modal (Bottom Sheet)
**File:** `src/components/molecules/SearchFilterModal.tsx` | **Duration:** 6h

**Design Specs:**
- Bottom sheet (slides up from bottom), drag handle at top (40×4px, `#E0E0E0`, centered)
- Header: `FunnelSimple` (20px) + "Filters" title + "Clear All" link (`#5DBB8E`, right-aligned)
- 8 filter sections (collapsible or flat): Category chips · Condition chips · Price range inputs · Size dropdown · Brand search · Age range slider · Location radius slider · Keywords input
- Chip multi-select: selected = `#5DBB8E` bg, white text; unselected = `#F0F0F0` bg, `#6B6B6B` text
- "Apply Filters" button — green pill, 52px, **sticky bottom** inside modal

**AI Prompt:**
```typescript
/*
TASK: Redesign SearchFilterModal — VISUAL ONLY
DO NOT CHANGE: filter state, apply handler, clear handler, any filter logic
ONLY CHANGE: StyleSheet, icons → Phosphor, bottom sheet layout

import { X, FunnelSimple, SlidersHorizontal, CheckSquare, Square } from 'phosphor-react-native';

BOTTOM SHEET HANDLE:
handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0', alignSelf: 'center', marginTop: 12, marginBottom: 16 }

CHIP (selected):
chipSelected: { backgroundColor: '#5DBB8E', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 }
chipSelectedText: { color: '#FFFFFF', fontSize: 13, fontWeight: '500' }

CHIP (unselected):
chipUnselected: { backgroundColor: '#F0F0F0', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 }
chipUnselectedText: { color: '#6B6B6B', fontSize: 13 }

PRICE INPUTS: filled style (#F0F0F0, borderRadius 12, height 48), side-by-side with "–" separator
APPLY BUTTON: backgroundColor '#5DBB8E', borderRadius 26, height 52, full width, sticky bottom
*/
// filepath: src/components/molecules/SearchFilterModal.tsx
```

---

#### ✅ Acceptance Criteria — FLOW-06 (Visual Only)

- [ ] Search bar is pill-shaped (48px, `borderRadius: 24`), filled style, `MagnifyingGlass` Phosphor icon left
- [ ] Filter button shows a green count badge when filters are active
- [ ] Active filter chips are green-outlined pills with `X` remove icons
- [ ] Item grid is 2 columns, 12px gap, 16px padding
- [ ] `Heart`/`HeartFill` and `Share` icons float as overlay on item images (top-right)
- [ ] Item detail price row shows SP earn badge: `Coins` icon (16px, `#F59E0B`), gold chip `#FEF3C7`
- [ ] `ShieldCheck` verified badge (16px, `#5DBB8E`) appears on seller card in ItemDetailScreen
- [ ] "Buy Now" is sticky bottom, green pill (52px), full width
- [ ] "Add to Cart" is secondary outlined (border `#5DBB8E`) above "Buy Now"
- [ ] SearchFilterModal has drag handle (40×4px, `#E0E0E0`) at top
- [ ] Selected filter chips: `#5DBB8E` background, white text
- [ ] "Apply Filters" button is sticky inside modal, green pill (52px)
- [ ] Category browse screen shows category icon (32px, `#5DBB8E`) in header
- [ ] Zero Ionicons imports in all 4 files

---

---

---

### TASK FLOW-07: Cart & Bundling

**Duration:** 8 hours  
**Priority:** P0 (Critical) — Purchase conversion  
**Screens:** 2 total  
**Asset Dependencies:** `ShoppingCart`, `Trash`, `Package`, `Tag`, `Coins`, `X`, `Plus`, `Minus`

---

> **🚫 FROZEN — UI REDESIGN SCOPE ONLY**
>
> Do NOT change: cart state management, add/remove item logic, bundle price calculation, supabase order calls, checkout navigation, any validation.
>
> **Only modify:** `StyleSheet` values · icon imports → Phosphor · layout JSX · colors · spacing

---

#### Description
Redesign the Cart and Bundle screens. The cart is a conversion-critical screen — it must feel fast and uncluttered. Bundle grouping is visually distinct but uses the same card language as My Listings.

#### Scope — Files to Modify

| # | Screen | File | Change Type |
|---|--------|------|-------------|
| 1 | Cart Screen | `src/screens/cart/CartScreen.tsx` | Restyle only |
| 2 | Bundle Builder | `src/screens/cart/BundleBuilderScreen.tsx` | Restyle only |

---

##### Screen 1 of 2: Cart Screen
**File:** `src/screens/cart/CartScreen.tsx` | **Duration:** 4h

**Design Specs:**
- Header: `ShoppingCart` (24px, `#1A1A1A`) + "My Cart" + item count badge (green pill)
- Cart item rows: thumbnail 72×72px (8px radius), title (15px semibold), price (15px), quantity controls (filled `#F0F0F0` chips), `Trash` (20px, `#E85D75`) far right
- Subtotal section: white card, 12px radius, showing item subtotal, SP discount row (`Coins` 16px `#F59E0B`), total (18px semibold `#1A1A1A`)
- "Checkout" button — green pill, 52px, sticky bottom
- Empty state: `ShoppingCart` (64px, `#E0E0E0`) + "Your cart is empty" + "Browse Items" green pill CTA

**AI Prompt:**
```typescript
/*
TASK: Redesign CartScreen — VISUAL ONLY
DO NOT CHANGE: add/remove handlers, price calculation logic, checkout navigation, supabase calls
ONLY CHANGE: StyleSheet, icons → Phosphor

import { ShoppingCart, Trash, Coins, Package, Minus, Plus } from 'phosphor-react-native';

CART ITEM ROW:
itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' }
thumbnail: { width: 72, height: 72, borderRadius: 8 }
itemTitle: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' }
itemPrice: { fontSize: 15, color: '#1A1A1A' }
Trash size={20} color="#E85D75" — far right

QTY CONTROLS:
qtyChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0F0', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, gap: 8 }
qtyText: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' }

SUMMARY CARD:
summaryCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginTop: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4 }
totalText: { fontSize: 18, fontWeight: '600', color: '#1A1A1A' }

SP ROW: Coins size={16} color="#F59E0B" + "–250 SP" in gold text '#F59E0B'

CHECKOUT BUTTON: backgroundColor '#5DBB8E', borderRadius 26, height 52, sticky bottom
EMPTY STATE: ShoppingCart size={64} color="#E0E0E0"
*/
// filepath: src/screens/cart/CartScreen.tsx
```

---

##### Screen 2 of 2: Bundle Builder Screen
**File:** `src/screens/cart/BundleBuilderScreen.tsx` | **Duration:** 4h

**Design Specs:**
- Heading: "Build a Bundle" — 24px semibold
- Subtext: "Add more items from this seller to save" — 15px, `#6B6B6B`
- Available items grid: 2-column, same ItemCard style as DiscoverScreen, `Plus` overlay on unselected, `CheckCircle` (green) on selected
- Bundle summary bar at bottom: item count chip + bundle total + "Save X%" badge (green) + "Add to Cart" green pill

**AI Prompt:**
```typescript
/*
TASK: Redesign BundleBuilderScreen — VISUAL ONLY
DO NOT CHANGE: bundle selection state, discount calculation, cart add handler, navigation
ONLY CHANGE: StyleSheet, icons → Phosphor

import { Plus, CheckCircle, Tag, Coins } from 'phosphor-react-native';

SELECTED ITEM OVERLAY:
selectedOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(93,187,142,0.15)', borderRadius: 8, justifyContent: 'center', alignItems: 'center' }
CheckCircle size={32} color="#5DBB8E" weight="fill" — centered

BUNDLE SUMMARY BAR (sticky bottom):
summaryBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F0F0F0' }
savingsBadge: { backgroundColor: '#E8F5F0', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }
savingsText: { fontSize: 12, color: '#5DBB8E', fontWeight: '600' }
ADD TO CART BUTTON: backgroundColor '#5DBB8E', borderRadius 26, height 44, paddingHorizontal 20
*/
// filepath: src/screens/cart/BundleBuilderScreen.tsx
```

---

#### ✅ Acceptance Criteria — FLOW-07 (Visual Only)

- [ ] Cart header shows `ShoppingCart` (Phosphor, 24px) and item count in a green pill badge
- [ ] Cart item rows have 72×72px thumbnail (8px radius), `Trash` icon in `#E85D75`
- [ ] Quantity controls are filled chips (`#F0F0F0`, 8px radius) with `Plus`/`Minus` Phosphor icons
- [ ] SP discount row shows `Coins` icon (16px, `#F59E0B`) with gold text
- [ ] Summary card has 12px radius, subtle shadow
- [ ] "Checkout" button is green pill (52px), sticky bottom
- [ ] Empty cart state shows `ShoppingCart` (64px, `#E0E0E0`)
- [ ] Bundle screen selected items show `CheckCircle` fill (32px, `#5DBB8E`) overlay
- [ ] Bundle savings badge is green tint (`#E8F5F0`) chip, `#5DBB8E` text

---
---

### TASK FLOW-08: Trade Flow

**Duration:** 28 hours  
**Priority:** P0 (Critical) — Core transaction engine  
**Screens:** 6 total  
**Asset Dependencies:** `ArrowsLeftRight`, `Coins`, `ShieldCheck`, `WarningCircle`, `CheckCircle`, `XCircle`, `Clock`, `ChatCircle`, `MapPin`, `Receipt`, `Flag`

---

> **🚫 FROZEN — UI REDESIGN SCOPE ONLY**
>
> Do NOT change: trade offer creation logic, trade status state machine, supabase trade calls, escrow/SP logic, dispute submission, trade acceptance/rejection handlers, navigation.
>
> **Only modify:** `StyleSheet` values · icon imports → Phosphor · layout JSX · colors · spacing

---

#### Description
Redesign the 6 trade flow screens. Trades are the heart of the marketplace — the UI must communicate trust and status clearly. Status colors follow strict semantic rules: pending=amber, active=green, disputed=red, completed=gray.

#### Scope — Files to Modify

| # | Screen | File | Change Type |
|---|--------|------|-------------|
| 1 | Trade Offer | `src/screens/trade/TradeOfferScreen.tsx` | Restyle only |
| 2 | Trade Review | `src/screens/trade/TradeReviewScreen.tsx` | Restyle only |
| 3 | Active Trade | `src/screens/trade/ActiveTradeScreen.tsx` | Restyle only |
| 4 | Trade History | `src/screens/trade/TradeHistoryScreen.tsx` | Restyle only |
| 5 | Trade Dispute | `src/screens/trade/TradeDisputeScreen.tsx` | Restyle only |
| 6 | Trade Success / Failure | `src/screens/trade/TradeResultScreen.tsx` | Restyle only |

---

##### Screen 1 of 6: Trade Offer Screen
**File:** `src/screens/trade/TradeOfferScreen.tsx` | **Duration:** 5h

**Design Specs:**
- Two-column "trade card" layout: Buyer side (left) ↔ Seller side (right), `ArrowsLeftRight` (24px, `#6B6B6B`) center divider
- Each side: seller avatar (48px circle), item thumbnail (80×80px, 8px radius), price, condition tag
- SP offer field: filled input with `Coins` icon (20px, `#F59E0B`) left, gold label "ADD SP OFFER"
- "Send Offer" button — green pill, 52px, full width

**AI Prompt:**
```typescript
/*
TASK: Redesign TradeOfferScreen — VISUAL ONLY
DO NOT CHANGE: offer submission handler, SP deduction logic, navigation, validation
ONLY CHANGE: StyleSheet, icons → Phosphor

import { ArrowsLeftRight, Coins, ShieldCheck } from 'phosphor-react-native';

TRADE CARD:
tradeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F7F7', borderRadius: 16, padding: 16, gap: 8 }
tradeSide: { flex: 1, alignItems: 'center', gap: 8 }
sellerAvatar: { width: 48, height: 48, borderRadius: 24 }
itemThumb: { width: 80, height: 80, borderRadius: 8 }
ArrowsLeftRight size={24} color="#6B6B6B" — center divider

SP INPUT: backgroundColor '#FEF3C7', borderRadius 12, height 52, Coins icon left (color '#F59E0B')
spLabel: { fontSize: 13, fontWeight: '500', color: '#F59E0B', textTransform: 'uppercase' }

SEND OFFER BUTTON: backgroundColor '#5DBB8E', borderRadius 26, height 52
*/
// filepath: src/screens/trade/TradeOfferScreen.tsx
```

---

##### Screen 2 of 6: Trade Review Screen
**File:** `src/screens/trade/TradeReviewScreen.tsx` | **Duration:** 5h

**Design Specs:**
- Trade summary card: two items side-by-side, `ArrowsLeftRight` divider
- SP summary row: `Coins` (16px, `#F59E0B`) + SP balance change preview
- Safety disclaimer box: `ShieldCheck` (20px, `#5DBB8E`) left, `#E8F5F0` background, 12px radius
- "Accept Trade" — green pill, 52px
- "Decline" — red text link (14px, `#E85D75`) below

**AI Prompt:**
```typescript
/*
TASK: Redesign TradeReviewScreen — VISUAL ONLY
DO NOT CHANGE: accept/decline handlers, SP deduction logic, navigation
ONLY CHANGE: StyleSheet, icons → Phosphor

import { ArrowsLeftRight, Coins, ShieldCheck } from 'phosphor-react-native';

DISCLAIMER BOX:
disclaimerBox: { backgroundColor: '#E8F5F0', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }
ShieldCheck size={20} color="#5DBB8E"
disclaimerText: { fontSize: 13, color: '#1A1A1A', flex: 1, lineHeight: 20 }

ACCEPT BUTTON: backgroundColor '#5DBB8E', borderRadius 26, height 52
DECLINE LINK: fontSize 14, color '#E85D75', textAlign 'center', paddingVertical 12
*/
// filepath: src/screens/trade/TradeReviewScreen.tsx
```

---

##### Screen 3 of 6: Active Trade Screen
**File:** `src/screens/trade/ActiveTradeScreen.tsx` | **Duration:** 5h

**Design Specs:**
- Status banner (full width): color-coded by trade status
  - Pending: `#FEF3C7` bg + `#D97706` text + `Clock` icon (20px)
  - Active/In Progress: `#E8F5F0` bg + `#5DBB8E` text + `ArrowsLeftRight` icon
  - Disputed: `#FEE2E2` bg + `#E85D75` text + `WarningCircle` icon
- Trade item cards (both sides, same as offer layout)
- Timeline steps: vertical line, step circles (completed=`#5DBB8E` fill, current=`#5DBB8E` outline, future=`#E0E0E0`)
- "Message Seller" secondary button: outlined, `ChatCircle` icon left (20px, `#5DBB8E`)
- "Confirm Receipt" green pill, 52px (only shown in correct state)

**AI Prompt:**
```typescript
/*
TASK: Redesign ActiveTradeScreen — VISUAL ONLY
DO NOT CHANGE: trade status polling, confirm receipt handler, message navigation, dispute trigger, supabase calls
ONLY CHANGE: StyleSheet, icons → Phosphor

import { Clock, ArrowsLeftRight, WarningCircle, CheckCircle, ChatCircle } from 'phosphor-react-native';

STATUS BANNER (varies by status — do NOT change status logic):
statusBannerPending: { backgroundColor: '#FEF3C7', padding: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }
statusBannerActive: { backgroundColor: '#E8F5F0', ... }
statusBannerDisputed: { backgroundColor: '#FEE2E2', ... }

TIMELINE STEP:
stepCircleDone: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#5DBB8E', justifyContent: 'center', alignItems: 'center' }
stepCircleCurrent: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#5DBB8E' }
stepCircleFuture: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#E0E0E0' }
stepLine: { width: 2, flex: 1, backgroundColor: '#E0E0E0' }

MESSAGE BUTTON (secondary):
messageBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#5DBB8E', borderRadius: 26, height: 48, justifyContent: 'center', gap: 8 }
ChatCircle size={20} color="#5DBB8E"

CONFIRM BUTTON: backgroundColor '#5DBB8E', borderRadius 26, height 52
*/
// filepath: src/screens/trade/ActiveTradeScreen.tsx
```

---

##### Screen 4 of 6: Trade History Screen
**File:** `src/screens/trade/TradeHistoryScreen.tsx` | **Duration:** 4h

**Design Specs:**
- Tabs: "Buying" | "Selling" — active tab underline `#5DBB8E`, 2px
- Trade history rows: avatar (40px), item thumb (56×56px, 8px radius), trade title, date (13px `#6B6B6B`), status badge (same color rules as Active Trade)
- Empty state: `Receipt` (64px, `#E0E0E0`) + "No trades yet"

**AI Prompt:**
```typescript
/*
TASK: Redesign TradeHistoryScreen — VISUAL ONLY
DO NOT CHANGE: trade data fetching, tab filter logic, navigation to trade detail
ONLY CHANGE: StyleSheet, icons → Phosphor, status badge colors

import { Receipt, ArrowsLeftRight } from 'phosphor-react-native';

TABS:
tab: { paddingVertical: 12, paddingHorizontal: 16 }
tabActive: { borderBottomWidth: 2, borderBottomColor: '#5DBB8E' }
tabText: { fontSize: 15, color: '#6B6B6B' }
tabTextActive: { color: '#1A1A1A', fontWeight: '600' }

TRADE ROW:
tradeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 }
tradeThumb: { width: 56, height: 56, borderRadius: 8 }
tradeDate: { fontSize: 13, color: '#6B6B6B' }

STATUS BADGE: Same pill chip system as MyListingsScreen (green/gray/amber/red)
EMPTY STATE: Receipt size={64} color="#E0E0E0"
*/
// filepath: src/screens/trade/TradeHistoryScreen.tsx
```

---

##### Screen 5 of 6: Trade Dispute Screen
**File:** `src/screens/trade/TradeDisputeScreen.tsx` | **Duration:** 5h

**Design Specs:**
- Alert banner: `#FEE2E2` bg, `WarningCircle` (20px, `#E85D75`), "Filing a Dispute" warning text
- Trade summary card (read-only) — same layout as TradeReviewScreen
- Reason selector: radio chips (multi-select), selected = `#E85D75` bg + white text, unselected = `#F0F0F0` + `#6B6B6B`
- Evidence upload area: dashed border, `Camera` icon (32px, `#6B6B6B`)
- Description textarea: filled style, 120px min height
- "Submit Dispute" button — danger red pill (`#E85D75`, 52px)
- "Cancel" — 14px, `#6B6B6B`

**AI Prompt:**
```typescript
/*
TASK: Redesign TradeDisputeScreen — VISUAL ONLY
DO NOT CHANGE: dispute submission handler, reason validation, file upload logic, supabase call, navigation
ONLY CHANGE: StyleSheet, icons → Phosphor

import { WarningCircle, Camera, Flag } from 'phosphor-react-native';

ALERT BANNER: Same pattern as ListingSafetyReviewScreen — backgroundColor '#FEE2E2'
WarningCircle size={20} color="#E85D75"

REASON CHIP (selected):
reasonChipSelected: { backgroundColor: '#E85D75', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 }
reasonChipSelectedText: { color: '#FFFFFF', fontSize: 13, fontWeight: '500' }
REASON CHIP (unselected): backgroundColor '#F0F0F0', text color '#6B6B6B'

EVIDENCE UPLOAD:
uploadArea: { borderWidth: 1, borderColor: '#E0E0E0', borderStyle: 'dashed', borderRadius: 12, padding: 24, alignItems: 'center', justifyContent: 'center' }
Camera size={32} color="#6B6B6B"

TEXTAREA: backgroundColor '#F0F0F0', borderRadius 12, minHeight 120, padding 16, textAlignVertical 'top'
SUBMIT BUTTON: backgroundColor '#E85D75', borderRadius 26, height 52
*/
// filepath: src/screens/trade/TradeDisputeScreen.tsx
```

---

##### Screen 6 of 6: Trade Result Screen (Success / Failure)
**File:** `src/screens/trade/TradeResultScreen.tsx` | **Duration:** 4h

**Design Specs:**
- **Success state:** `CheckCircle` (72px, `#5DBB8E` fill) centered, "Trade Complete!" heading (24px semibold), SP earned badge (`Coins` 20px `#F59E0B` + "You earned 350 SP" gold chip), "Rate This Trade" green pill, "Back to Home" text link
- **Failure/Cancelled state:** `XCircle` (72px, `#E85D75` fill) centered, "Trade Cancelled" heading, 15px gray body, "Find More Items" green pill

**AI Prompt:**
```typescript
/*
TASK: Redesign TradeResultScreen — VISUAL ONLY
DO NOT CHANGE: result state logic, SP award logic, rating navigation, home navigation
ONLY CHANGE: StyleSheet, icons → Phosphor

import { CheckCircle, XCircle, Coins } from 'phosphor-react-native';

SUCCESS STATE:
CheckCircle size={72} color="#5DBB8E" weight="fill" — centered
heading: { fontSize: 24, fontWeight: '600', color: '#1A1A1A', textAlign: 'center', marginTop: 16 }
SP BADGE: Coins size={20} color="#F59E0B" + text, backgroundColor '#FEF3C7', borderRadius 12, paddingHorizontal 12
RATE BUTTON: backgroundColor '#5DBB8E', borderRadius 26, height 52
BACK LINK: fontSize 14, color '#6B6B6B', textAlign 'center', paddingVertical 12

FAILURE STATE:
XCircle size={72} color="#E85D75" weight="fill" — centered
Heading + gray body text — same centered layout
CTA button still green pill (Browse items)
*/
// filepath: src/screens/trade/TradeResultScreen.tsx
```

---

#### ✅ Acceptance Criteria — FLOW-08 (Visual Only)

- [ ] Trade offer shows two-column card with `ArrowsLeftRight` (24px, `#6B6B6B`) divider
- [ ] SP offer input has gold background (`#FEF3C7`), `Coins` icon (20px, `#F59E0B`)
- [ ] Safety disclaimer box has `#E8F5F0` background, `ShieldCheck` icon (20px, `#5DBB8E`)
- [ ] "Decline" is a red text link (`#E85D75`), NOT a button
- [ ] Status banners use correct color: pending=`#FEF3C7`, active=`#E8F5F0`, disputed=`#FEE2E2`
- [ ] Timeline step circles: done=`#5DBB8E` filled, current=`#5DBB8E` outlined, future=`#E0E0E0`
- [ ] "Message Seller" is secondary outlined (border `#5DBB8E`), NOT filled
- [ ] Trade history tabs show `#5DBB8E` underline on active tab (no filled background)
- [ ] Dispute reason chips: selected=`#E85D75` background, unselected=`#F0F0F0`
- [ ] "Submit Dispute" is `#E85D75` red pill, NOT green
- [ ] Trade success shows `CheckCircle` (72px fill `#5DBB8E`), trade failure shows `XCircle` (72px fill `#E85D75`)
- [ ] SP earned badge on success screen: `Coins` icon, `#FEF3C7` background, `#F59E0B` text

---
---

### TASK FLOW-10/11: SP Wallet

**Duration:** 10 hours  
**Priority:** P1 (High) — Engagement & retention driver  
**Screens:** 2 total  
**Asset Dependencies:** `Wallet`, `Coins`, `ArrowUp`, `ArrowDown`, `Receipt`, `TrendUp`, `Clock`, `CheckCircle`, `Crown`

---

> **🚫 FROZEN — UI REDESIGN SCOPE ONLY**
>
> Do NOT change: SP balance fetch, transaction history query, SP redemption logic, payout trigger, supabase calls, navigation.
>
> **Only modify:** `StyleSheet` values · icon imports → Phosphor · layout JSX · colors · spacing

---

#### Description
Redesign the SP Wallet and Transaction History screens. The SP Wallet is the rewards hub — it must feel premium. Use gold (`#F59E0B`) consistently for all SP-related elements. Balance is the hero number — large, centered, prominent.

#### Scope — Files to Modify

| # | Screen | File | Change Type |
|---|--------|------|-------------|
| 1 | SP Wallet Screen | `src/screens/sp/SpWalletScreen.tsx` | Restyle only |
| 2 | SP Transaction History | `src/screens/sp/SpTransactionHistoryScreen.tsx` | Restyle only |

---

##### Screen 1 of 2: SP Wallet Screen
**File:** `src/screens/sp/SpWalletScreen.tsx` | **Duration:** 5h

**Design Specs:**
- Hero balance card: full-width, `#5DBB8E` bg gradient-like (or solid `#5DBB8E`), 16px radius, white text, `Coins` (40px, white) above balance, balance = 36px bold white, "Swap Points" label 14px white opacity 0.8
- Quick action row: 3 buttons — "Redeem" (`ArrowUp`), "Earn More" (`Coins`), "History" (`Receipt`) — icon 24px + 12px label, white bg cards, 12px radius
- "How to earn" section: icon-list rows (`Storefront`, `ArrowsLeftRight`, `UserPlus`) each with SP amount chip (gold)
- Lifetime stats row: 3 chips — Total Earned / Total Spent / Pending

**AI Prompt:**
```typescript
/*
TASK: Redesign SpWalletScreen — VISUAL ONLY
DO NOT CHANGE: balance fetch, redemption handler, navigation, any SP calculation
ONLY CHANGE: StyleSheet, icons → Phosphor

import { Wallet, Coins, ArrowUp, Receipt, Storefront, ArrowsLeftRight, UserPlus, TrendUp } from 'phosphor-react-native';

HERO BALANCE CARD:
heroCard: { backgroundColor: '#5DBB8E', borderRadius: 16, padding: 24, alignItems: 'center', marginHorizontal: 16, marginTop: 16 }
Coins size={40} color="rgba(255,255,255,0.9)"
balanceAmount: { fontSize: 36, fontWeight: '700', color: '#FFFFFF', marginTop: 8 }
balanceLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)' }

QUICK ACTION BUTTON:
actionBtn: { flex: 1, alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4 }
actionLabel: { fontSize: 12, color: '#1A1A1A', marginTop: 4, fontWeight: '500' }

SP EARN ROW:
earnRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 }
spChip: { backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }
spChipText: { fontSize: 12, color: '#F59E0B', fontWeight: '600' }

STAT CHIP:
statChip: { flex: 1, alignItems: 'center', backgroundColor: '#F7F7F7', borderRadius: 12, padding: 12 }
statAmount: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' }
statLabel: { fontSize: 11, color: '#6B6B6B', marginTop: 2 }
*/
// filepath: src/screens/sp/SpWalletScreen.tsx
```

---

##### Screen 2 of 2: SP Transaction History Screen
**File:** `src/screens/sp/SpTransactionHistoryScreen.tsx` | **Duration:** 5h

**Design Specs:**
- Tabs: "All" | "Earned" | "Spent" — `#5DBB8E` underline on active
- Transaction rows: icon left (type-based, 36×36px circle bg), description (15px semibold), date (13px `#6B6B6B`), amount right — earned = `+350 SP` in `#5DBB8E`, spent = `-200 SP` in `#E85D75`
- Icon per type: Sale → `Storefront` (green), Trade → `ArrowsLeftRight` (green), Redemption → `ArrowUp` (amber), Referral → `UserPlus` (green), Pending → `Clock` (gray)
- Empty state: `Coins` (64px, `#E0E0E0`) + "No transactions yet"

**AI Prompt:**
```typescript
/*
TASK: Redesign SpTransactionHistoryScreen — VISUAL ONLY
DO NOT CHANGE: transaction data fetch, tab filter logic, navigation
ONLY CHANGE: StyleSheet, icons → Phosphor

import { Storefront, ArrowsLeftRight, ArrowUp, UserPlus, Clock, Coins } from 'phosphor-react-native';

TRANSACTION ROW:
txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 }
txIconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E8F5F0', justifyContent: 'center', alignItems: 'center' }
txTitle: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' }
txDate: { fontSize: 13, color: '#6B6B6B' }
txAmountEarned: { fontSize: 15, fontWeight: '600', color: '#5DBB8E' }
txAmountSpent: { fontSize: 15, fontWeight: '600', color: '#E85D75' }

TABS: Same underline pattern as TradeHistoryScreen
EMPTY STATE: Coins size={64} color="#E0E0E0"
*/
// filepath: src/screens/sp/SpTransactionHistoryScreen.tsx
```

---

#### ✅ Acceptance Criteria — FLOW-10/11 (Visual Only)

- [ ] Hero balance card has `#5DBB8E` background, white text, `Coins` (40px, white) above balance
- [ ] Balance amount is 36px bold white — largest text element on screen
- [ ] Quick action buttons are white cards with 12px radius and subtle shadow
- [ ] SP earn rows show gold chips (`#FEF3C7` bg, `#F59E0B` text, `#F59E0B` `Coins` icon)
- [ ] 3 lifetime stat chips shown in a row, `#F7F7F7` background
- [ ] Transaction history tabs use `#5DBB8E` underline (no filled background)
- [ ] Earned SP amounts show in `#5DBB8E` green with "+" prefix
- [ ] Spent SP amounts show in `#E85D75` red with "–" prefix
- [ ] Transaction icon circles use `#E8F5F0` background, type-specific Phosphor icon
- [ ] Empty state shows `Coins` (64px, `#E0E0E0`)

---
---

### TASK FLOW-12: Subscriptions

**Duration:** 24 hours  
**Priority:** P1 (High) — Revenue critical  
**Screens:** 8 total  
**Asset Dependencies:** `Crown`, `CrownSimple`, `CheckCircle`, `X`, `CreditCard`, `ArrowClockwise`, `WarningCircle`, `Coins`, `Star`, `Receipt`

---

> **🚫 FROZEN — UI REDESIGN SCOPE ONLY**
>
> Do NOT change: subscription plan data fetch, Stripe/payment integration, plan comparison logic, upgrade/downgrade handlers, cancel flow, any billing logic, navigation.
>
> **Only modify:** `StyleSheet` values · icon imports → Phosphor · layout JSX · colors · spacing

---

#### Description
Redesign the 8 subscription screens. Plan tier cards must clearly differentiate Free, Basic, and Pro. The Pro tier uses gold (`#F59E0B`) as its accent. Feature comparison uses `CheckCircle`/`X` icons. The cancel screen uses a retention-focused design (benefits reminder before confirmation).

#### Scope — Files to Modify

| # | Screen | File | Change Type |
|---|--------|------|-------------|
| 1 | Subscription Plans | `src/screens/subscription/SubscriptionPlansScreen.tsx` | Restyle only |
| 2 | Plan Comparison | `src/screens/subscription/PlanComparisonScreen.tsx` | Restyle only |
| 3 | Checkout / Payment | `src/screens/subscription/SubscriptionCheckoutScreen.tsx` | Restyle only |
| 4 | Subscription Success | `src/screens/subscription/SubscriptionSuccessScreen.tsx` | Restyle only |
| 5 | My Subscription | `src/screens/subscription/MySubscriptionScreen.tsx` | Restyle only |
| 6 | Upgrade Plan | `src/screens/subscription/UpgradePlanScreen.tsx` | Restyle only |
| 7 | Cancel Subscription | `src/screens/subscription/CancelSubscriptionScreen.tsx` | Restyle only |
| 8 | Subscription Expired | `src/screens/subscription/SubscriptionExpiredScreen.tsx` | Restyle only |

---

##### Screen 1 of 8: Subscription Plans Screen
**File:** `src/screens/subscription/SubscriptionPlansScreen.tsx` | **Duration:** 4h

**Design Specs:**
- 3 plan cards: Free · Basic · Pro — vertically stacked
- Free: white bg, `#E0E0E0` border, `CrownSimple` (24px, `#6B6B6B`)
- Basic: white bg, `#5DBB8E` border (2px), `Crown` (24px, `#5DBB8E`)
- Pro: `#1A1A1A` dark bg, `Crown` (24px, `#F59E0B`) — gold accent, white text
- "Most Popular" badge on Basic: `#5DBB8E` pill, 12px, white text, absolute top-right
- Price: 28px bold (tier color), "/month" 14px muted
- Feature list: `CheckCircle` (16px, tier color) for each included feature
- CTA button per card: Free="Current Plan" (gray), Basic="Upgrade" (green pill), Pro="Go Pro" (gold pill `#F59E0B`)

**AI Prompt:**
```typescript
/*
TASK: Redesign SubscriptionPlansScreen — VISUAL ONLY
DO NOT CHANGE: plan data, upgrade handlers, current plan detection, navigation
ONLY CHANGE: StyleSheet, icons → Phosphor

import { Crown, CrownSimple, CheckCircle, X } from 'phosphor-react-native';

FREE CARD: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E0E0E0', padding: 20 }
BASIC CARD: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 2, borderColor: '#5DBB8E', padding: 20 }
PRO CARD: { backgroundColor: '#1A1A1A', borderRadius: 16, padding: 20 }

MOST POPULAR BADGE: { position: 'absolute', top: -10, right: 16, backgroundColor: '#5DBB8E', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 2 }
badgeText: { fontSize: 12, color: '#FFFFFF', fontWeight: '600' }

PRICE (Basic): { fontSize: 28, fontWeight: '700', color: '#5DBB8E' }
PRICE (Pro): { fontSize: 28, fontWeight: '700', color: '#F59E0B' }

FEATURE ROW: CheckCircle size={16} color="[tier color]" + text (14px, #1A1A1A or white for Pro)

FREE BUTTON: { backgroundColor: '#F0F0F0', borderRadius: 26, height: 44 }
BASIC BUTTON: { backgroundColor: '#5DBB8E', borderRadius: 26, height: 44 }
PRO BUTTON: { backgroundColor: '#F59E0B', borderRadius: 26, height: 44 }
*/
// filepath: src/screens/subscription/SubscriptionPlansScreen.tsx
```

---

##### Screen 2 of 8: Plan Comparison Screen
**File:** `src/screens/subscription/PlanComparisonScreen.tsx` | **Duration:** 3h

**Design Specs:**
- Comparison table: feature rows × 3 plan columns
- Column headers: plan name (14px semibold) + crown icon + price chip
- Cells: `CheckCircle` (16px, tier color) for included, `X` (16px, `#E0E0E0`) for not included, text value for limits
- Sticky header as user scrolls
- "Choose Plan" CTA row at bottom per column

**AI Prompt:**
```typescript
/*
TASK: Redesign PlanComparisonScreen — VISUAL ONLY
DO NOT CHANGE: feature data, plan selection handler, navigation
ONLY CHANGE: StyleSheet, icons → Phosphor

import { Crown, CrownSimple, CheckCircle, X } from 'phosphor-react-native';

TABLE HEADER:
colHeader: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2 }
Free: borderBottomColor '#E0E0E0' | Basic: borderBottomColor '#5DBB8E' | Pro: borderBottomColor '#F59E0B'

FEATURE ROW:
featureRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' }
featureCell: { flex: 1, alignItems: 'center', justifyContent: 'center' }

CheckCircle size={16}: Free color="#6B6B6B", Basic color="#5DBB8E", Pro color="#F59E0B"
X size={16} color="#E0E0E0" — for not included
*/
// filepath: src/screens/subscription/PlanComparisonScreen.tsx
```

---

##### Screen 3 of 8: Subscription Checkout Screen
**File:** `src/screens/subscription/SubscriptionCheckoutScreen.tsx` | **Duration:** 3h

**Design Specs:**
- Plan summary card: selected plan name, price, billing cycle, crown icon (tier color)
- Payment method row: `CreditCard` (24px, `#6B6B6B`) + card last 4 digits + "Change" link (`#5DBB8E`)
- Total row: bold 18px, green checkmark bullet
- Terms note: 13px `#6B6B6B`
- "Subscribe Now" — green pill (or gold for Pro), 52px

**AI Prompt:**
```typescript
/*
TASK: Redesign SubscriptionCheckoutScreen — VISUAL ONLY
DO NOT CHANGE: payment handler, plan props, Stripe integration, navigation
ONLY CHANGE: StyleSheet, icons → Phosphor

import { CreditCard, Crown, CrownSimple, CheckCircle } from 'phosphor-react-native';

PLAN SUMMARY CARD: same card style as CartScreen summary card (white, 12px radius, elevation 2)
PAYMENT ROW: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' }
CreditCard size={24} color="#6B6B6B"
CHANGE LINK: fontSize 14, color '#5DBB8E'
TOTAL: fontSize 18, fontWeight '600', color '#1A1A1A'
SUBSCRIBE BUTTON: backgroundColor '#5DBB8E' (or '#F59E0B' for Pro), borderRadius 26, height 52
*/
// filepath: src/screens/subscription/SubscriptionCheckoutScreen.tsx
```

---

##### Screen 4 of 8: Subscription Success Screen
**File:** `src/screens/subscription/SubscriptionSuccessScreen.tsx` | **Duration:** 2h

**Design Specs:**
- `CheckCircle` (72px, `#5DBB8E` fill) or `Crown` (64px, `#F59E0B`) for Pro — centered
- "You're now a [Plan] member!" — 24px semibold
- 3 benefit chips below in a row
- "Start Exploring" — green pill, 52px

**AI Prompt:**
```typescript
/*
TASK: Redesign SubscriptionSuccessScreen — VISUAL ONLY
DO NOT CHANGE: plan name from navigation params, navigation on CTA
ONLY CHANGE: StyleSheet, icons → Phosphor

import { CheckCircle, Crown } from 'phosphor-react-native';

SUCCESS ICON (conditional on plan — DO NOT change plan detection logic):
isPro ? <Crown size={64} color="#F59E0B" weight="fill" /> : <CheckCircle size={72} color="#5DBB8E" weight="fill" />

heading: { fontSize: 24, fontWeight: '600', color: '#1A1A1A', textAlign: 'center', marginTop: 16 }
BENEFIT CHIPS: same green chip style as SPBadge — row of 3
CTA BUTTON: backgroundColor '#5DBB8E', borderRadius 26, height 52
*/
// filepath: src/screens/subscription/SubscriptionSuccessScreen.tsx
```

---

##### Screen 5 of 8: My Subscription Screen
**File:** `src/screens/subscription/MySubscriptionScreen.tsx` | **Duration:** 3h

**Design Specs:**
- Active plan card: plan name (20px semibold), crown icon (tier color), renewal date (13px `#6B6B6B`), status badge (green "Active" chip)
- Benefits list: `CheckCircle` (16px, `#5DBB8E`) per benefit, 15px text
- "Upgrade Plan" button — green pill (only shown on non-Pro), 48px
- "Cancel Subscription" — 14px, `#E85D75`, text link at bottom

**AI Prompt:**
```typescript
/*
TASK: Redesign MySubscriptionScreen — VISUAL ONLY
DO NOT CHANGE: subscription data fetch, cancel navigation, upgrade navigation
ONLY CHANGE: StyleSheet, icons → Phosphor

import { Crown, CrownSimple, CheckCircle } from 'phosphor-react-native';

PLAN CARD: backgroundColor '#FFFFFF', borderRadius 16, borderWidth 2, borderColor '[tier color]', padding 20
renewalDate: { fontSize: 13, color: '#6B6B6B' }
ACTIVE BADGE: { backgroundColor: '#E8F5F0', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }
activeText: { fontSize: 12, color: '#5DBB8E', fontWeight: '500' }
CheckCircle size={16} color="#5DBB8E" — per benefit
UPGRADE BUTTON: backgroundColor '#5DBB8E', borderRadius 26, height 48
CANCEL LINK: fontSize 14, color '#E85D75', textAlign 'center', paddingVertical 16
*/
// filepath: src/screens/subscription/MySubscriptionScreen.tsx
```

---

##### Screen 6 of 8: Upgrade Plan Screen
**File:** `src/screens/subscription/UpgradePlanScreen.tsx` | **Duration:** 2h

**Design Specs:**
- Identical layout to SubscriptionPlansScreen but highlights the current plan and dims it
- "Current Plan" chip on the user's plan (gray, non-interactive)
- Higher tier plans show as upgrade targets with full CTA

**AI Prompt:**
```typescript
/*
TASK: Redesign UpgradePlanScreen — VISUAL ONLY
DO NOT CHANGE: current plan detection, upgrade handler, navigation
ONLY CHANGE: StyleSheet, icons → Phosphor

Mirror SubscriptionPlansScreen layout exactly.
Add visual treatment for "Current Plan":
currentPlanOverlay: { opacity: 0.5 }
currentPlanChip: { backgroundColor: '#F0F0F0', borderRadius: 10, paddingHorizontal: 8 }
currentPlanText: { fontSize: 12, color: '#6B6B6B' }
*/
// filepath: src/screens/subscription/UpgradePlanScreen.tsx
```

---

##### Screen 7 of 8: Cancel Subscription Screen
**File:** `src/screens/subscription/CancelSubscriptionScreen.tsx` | **Duration:** 3h

**Design Specs:**
- Warning banner: `WarningCircle` (20px, `#E85D75`), `#FEE2E2` bg — "You'll lose these benefits"
- Benefits loss list: `X` (16px, `#E85D75`) per benefit (retention nudge — visual only)
- Confirmation text: 15px, `#6B6B6B`, centered
- "Keep My Subscription" — green pill, 52px (primary action — keep)
- "Cancel Anyway" — 14px, `#E85D75`, text link at bottom

**AI Prompt:**
```typescript
/*
TASK: Redesign CancelSubscriptionScreen — VISUAL ONLY
DO NOT CHANGE: cancel handler, keep handler, navigation
ONLY CHANGE: StyleSheet, icons → Phosphor

import { WarningCircle, X } from 'phosphor-react-native';

WARNING BANNER: backgroundColor '#FEE2E2', borderRadius 8, padding 12
WarningCircle size={20} color="#E85D75"
bannerText: { fontSize: 14, color: '#E85D75', fontWeight: '500' }

BENEFITS LOSS LIST:
X size={16} color="#E85D75" + benefit text (fontSize 15, color '#1A1A1A')

KEEP BUTTON: backgroundColor '#5DBB8E', borderRadius 26, height 52, width '100%'
CANCEL LINK: fontSize 14, color '#E85D75', textAlign 'center', paddingVertical 16
*/
// filepath: src/screens/subscription/CancelSubscriptionScreen.tsx
```

---

##### Screen 8 of 8: Subscription Expired Screen
**File:** `src/screens/subscription/SubscriptionExpiredScreen.tsx` | **Duration:** 2h

**Design Specs:**
- `WarningCircle` (64px, `#FFA726` amber) centered — not error red, amber for expired
- "Subscription Expired" — 24px semibold
- "Your [Plan] plan expired on [date]" — 15px, `#6B6B6B`
- "Renew Now" — green pill, 52px
- "Continue Free" — 14px, `#6B6B6B`, text link

**AI Prompt:**
```typescript
/*
TASK: Redesign SubscriptionExpiredScreen — VISUAL ONLY
DO NOT CHANGE: renew handler, continue free handler, plan/date params
ONLY CHANGE: StyleSheet, icons → Phosphor

import { WarningCircle } from 'phosphor-react-native';
WarningCircle size={64} color="#FFA726" weight="regular" — centered
RENEW BUTTON: backgroundColor '#5DBB8E', borderRadius 26, height 52
CONTINUE LINK: fontSize 14, color '#6B6B6B'
*/
// filepath: src/screens/subscription/SubscriptionExpiredScreen.tsx
```

---

#### ✅ Acceptance Criteria — FLOW-12 (Visual Only)

- [ ] Free plan card: white bg, `#E0E0E0` border, `CrownSimple` gray (24px)
- [ ] Basic plan card: white bg, `#5DBB8E` border (2px), `Crown` green (24px), "Most Popular" badge top-right
- [ ] Pro plan card: `#1A1A1A` dark bg, white text, `Crown` gold (24px, `#F59E0B`)
- [ ] "Subscribe Now" button is gold (`#F59E0B`) for Pro, green for Basic
- [ ] Plan comparison: `CheckCircle` (included) and `X` (excluded) use correct tier colors
- [ ] My Subscription: active badge is `#E8F5F0` bg, `#5DBB8E` text
- [ ] "Cancel Subscription" is red text link (`#E85D75`) — NOT a button
- [ ] "Keep My Subscription" is the primary green pill — cancel is secondary
- [ ] Cancel screen warning banner has `#FEE2E2` bg, `WarningCircle` (20px, `#E85D75`)
- [ ] Expired screen uses `WarningCircle` (64px, **amber** `#FFA726`) — not error red
- [ ] Success screen: `CheckCircle` (72px, `#5DBB8E` fill) for Basic, `Crown` (64px, `#F59E0B` fill) for Pro

---
---

### TASK FLOW-14: Messaging

**Duration:** 10 hours  
**Priority:** P1 (High) — Buyer-seller trust layer  
**Screens:** 2 total  
**Asset Dependencies:** `ChatCircle`, `PaperPlaneRight`, `PaperClip`, `Smiley`, `MagnifyingGlass`, `ChatCircleSlash`, `Check`, `ArrowsLeftRight`, `ShieldCheck`

---

> **🚫 FROZEN — UI REDESIGN SCOPE ONLY**
>
> Do NOT change: message send handler, real-time subscription logic, conversation data fetch, file attachment logic, navigation.
>
> **Only modify:** `StyleSheet` values · icon imports → Phosphor · layout JSX · colors · spacing

---

#### Description
Redesign the 2 messaging screens. The Conversations list is the inbox — clean, scannable rows. The Chat screen follows standard mobile chat conventions: sent messages right-aligned green bubbles, received messages left-aligned gray bubbles.

#### Scope — Files to Modify

| # | Screen | File | Change Type |
|---|--------|------|-------------|
| 1 | Conversations List | `src/screens/messaging/ConversationsScreen.tsx` | Restyle only |
| 2 | Chat / Message Thread | `src/screens/messaging/ChatScreen.tsx` | Restyle only |

---

##### Screen 1 of 2: Conversations List Screen
**File:** `src/screens/messaging/ConversationsScreen.tsx` | **Duration:** 4h

**Design Specs:**
- Search bar: same pill search bar as DiscoverScreen (48px, `MagnifyingGlass` left)
- Conversation rows: avatar (48px circle), name (15px semibold `#1A1A1A`), last message preview (14px `#6B6B6B`, 1 line max), timestamp (12px `#999999`), unread badge (green pill, white count text, 16px circle)
- Unread row: white bg, unread badge visible
- Read row: same layout, no badge, name slightly lighter
- Trade context chip (optional): `ArrowsLeftRight` (12px, `#5DBB8E`) + item thumbnail (24×24px) inline in the row
- Empty state: `ChatCircleSlash` (64px, `#E0E0E0`) + "No messages yet"

**AI Prompt:**
```typescript
/*
TASK: Redesign ConversationsScreen — VISUAL ONLY
DO NOT CHANGE: conversation data fetch, unread count logic, navigation to ChatScreen
ONLY CHANGE: StyleSheet, icons → Phosphor

import { ChatCircle, MagnifyingGlass, ChatCircleSlash, ArrowsLeftRight } from 'phosphor-react-native';

CONVERSATION ROW:
convRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 12 }
avatar: { width: 48, height: 48, borderRadius: 24 }
convName: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' }
convPreview: { fontSize: 14, color: '#6B6B6B', numberOfLines: 1 }
convTime: { fontSize: 12, color: '#999999' }

UNREAD BADGE:
unreadBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#5DBB8E', justifyContent: 'center', alignItems: 'center' }
unreadText: { fontSize: 11, color: '#FFFFFF', fontWeight: '600' }

TRADE CHIP:
tradeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }
ArrowsLeftRight size={12} color="#5DBB8E"
tradeThumbnail: { width: 24, height: 24, borderRadius: 4 }

EMPTY STATE: ChatCircleSlash size={64} color="#E0E0E0"
SEARCH BAR: Same as DiscoverScreen (#F0F0F0, borderRadius 24, height 48)
*/
// filepath: src/screens/messaging/ConversationsScreen.tsx
```

---

##### Screen 2 of 2: Chat Screen
**File:** `src/screens/messaging/ChatScreen.tsx` | **Duration:** 6h

**Design Specs:**
- Header: back arrow + seller avatar (36px) + name + `ShieldCheck` (14px, `#5DBB8E`) if verified
- Trade context banner (if trade-linked): `ArrowsLeftRight` (16px) + item name + "View Trade" link (`#5DBB8E`) — `#F7F7F7` bg, collapsible
- Sent messages (right): `#5DBB8E` bg, white text, 16px radius (16 top-right = 4)
- Received messages (left): `#F0F0F0` bg, `#1A1A1A` text, 16px radius (16 top-left = 4)
- Message timestamp: 11px, `#999999`, below each bubble
- Read receipts: `Check` (12px, `#5DBB8E`) double-check for read
- Message input bar: `#F7F7F7` bg strip — `PaperClip` left (20px, `#6B6B6B`), filled input (flex 1, 40px, `#F0F0F0`, 20px radius), `Smiley` right (20px, `#6B6B6B`), `PaperPlaneRight` send (24px, `#5DBB8E`, shown only when text present)

**AI Prompt:**
```typescript
/*
TASK: Redesign ChatScreen — VISUAL ONLY
DO NOT CHANGE: send message handler, real-time subscription, file picker, navigation, message pagination
ONLY CHANGE: StyleSheet, icons → Phosphor, bubble layout

import { PaperPlaneRight, PaperClip, Smiley, Check, ShieldCheck, ArrowsLeftRight } from 'phosphor-react-native';

MESSAGE BUBBLES:
sentBubble: { backgroundColor: '#5DBB8E', borderRadius: 16, borderTopRightRadius: 4, padding: 12, maxWidth: '75%', alignSelf: 'flex-end', marginBottom: 4 }
sentText: { fontSize: 15, color: '#FFFFFF', lineHeight: 22 }
receivedBubble: { backgroundColor: '#F0F0F0', borderRadius: 16, borderTopLeftRadius: 4, padding: 12, maxWidth: '75%', alignSelf: 'flex-start', marginBottom: 4 }
receivedText: { fontSize: 15, color: '#1A1A1A', lineHeight: 22 }
messageTime: { fontSize: 11, color: '#999999', alignSelf: 'flex-end', marginTop: 2 }

READ RECEIPT: Check size={12} color="#5DBB8E" — double icon or single

TRADE BANNER:
tradeBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F7F7', paddingHorizontal: 16, paddingVertical: 8, gap: 8 }
viewTradeLink: { fontSize: 13, color: '#5DBB8E', fontWeight: '500' }
ArrowsLeftRight size={16} color="#5DBB8E"

INPUT BAR:
inputBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F7F7', paddingHorizontal: 12, paddingVertical: 8, gap: 8 }
messageInput: { flex: 1, backgroundColor: '#F0F0F0', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, fontSize: 15, color: '#1A1A1A' }
PaperPlaneRight size={24} color="#5DBB8E" — shown only when text.length > 0 (DO NOT change this condition)
*/
// filepath: src/screens/messaging/ChatScreen.tsx
```

---

#### ✅ Acceptance Criteria — FLOW-14 (Visual Only)

- [ ] Conversations search bar is pill-shaped (48px, `#F0F0F0`), `MagnifyingGlass` Phosphor icon left
- [ ] Unread badge is 20px green circle (`#5DBB8E`), white count text (11px)
- [ ] Trade context chip shows `ArrowsLeftRight` (12px, `#5DBB8E`) + small item thumbnail (24px)
- [ ] Empty state: `ChatCircleSlash` (64px, `#E0E0E0`)
- [ ] Sent message bubbles: `#5DBB8E` bg, white text, `borderTopRightRadius: 4`
- [ ] Received message bubbles: `#F0F0F0` bg, `#1A1A1A` text, `borderTopLeftRadius: 4`
- [ ] `ShieldCheck` (14px, `#5DBB8E`) in chat header for verified sellers
- [ ] Trade context banner: `#F7F7F7` bg, `ArrowsLeftRight` green icon, "View Trade" green link
- [ ] `PaperPlaneRight` send icon (24px, `#5DBB8E`) only visible when input has text
- [ ] `PaperClip` and `Smiley` icons are 20px, `#6B6B6B` — NOT green
- [ ] Read receipt uses `Check` Phosphor icon (12px, `#5DBB8E`)

---

---

### TASK FLOW-15: User Profile

**Duration:** 14 hours  
**Priority:** P1 (High) — Identity & trust  
**Screens:** 4 total  
**Asset Dependencies:** `User`, `Camera`, `PencilSimple`, `Star`, `Storefront`, `ShieldCheck`, `MapPin`, `UserPlus`, `CalendarBlank`, `Medal`, `Lock`

---

> **🚫 FROZEN — UI REDESIGN SCOPE ONLY**
>
> Do NOT change: profile data fetch, avatar upload logic, follow/unfollow handler, rating data, navigation.
>
> **Only modify:** `StyleSheet` values · icon imports → Phosphor · layout JSX · colors · spacing

---

#### Description
Redesign the 3 profile screens. The public seller profile is the trust anchor for buyers — ratings, verified badge, and listing grid must be immediately scannable. The edit profile screen reuses the same filled-input system as auth screens.

#### Scope — Files to Modify

| # | Screen | File | Change Type |
|---|--------|------|-------------|
| 1 | My Profile | `src/screens/profile/MyProfileScreen.tsx` | Restyle only |
| 2 | Edit Profile | `src/screens/profile/EditProfileScreen.tsx` | Restyle only |
| 3 | Public Seller Profile | `src/screens/profile/SellerProfileScreen.tsx` | Restyle only |
| 4 | Badges | `src/screens/profile/BadgesScreen.tsx` | Restyle only |

---

##### Screen 1 of 3: My Profile Screen
**File:** `src/screens/profile/MyProfileScreen.tsx` | **Duration:** 4h

**Design Specs:**
- Avatar: 96px circle, `#F0F0F0` placeholder, `Camera` icon overlay (20px, white on dark overlay) bottom-right
- Name: 20px semibold, `#1A1A1A`
- `ShieldCheck` (16px, `#5DBB8E`) if verified, inline after name
- Location: `MapPin` (14px, `#6B6B6B`) + node name (14px, `#6B6B6B`)
- Stats row: 3 chips (Listings / Trades / SP Balance) — `#F7F7F7` bg, 12px radius
- "Edit Profile" button: secondary outlined, `PencilSimple` icon left (16px, `#5DBB8E`), 44px, pill
- Active listings grid: 2-column, same ItemCard style

**AI Prompt:**
```typescript
/*
TASK: Redesign MyProfileScreen — VISUAL ONLY
DO NOT CHANGE: profile data fetch, listing fetch, navigation
ONLY CHANGE: StyleSheet, icons → Phosphor

import { Camera, ShieldCheck, MapPin, PencilSimple } from 'phosphor-react-native';

AVATAR:
avatarContainer: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#F0F0F0', position: 'relative' }
cameraOverlay: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: '#5DBB8E', justifyContent: 'center', alignItems: 'center' }
Camera size={14} color="#FFFFFF"

STATS CHIP ROW:
statChip: { flex: 1, alignItems: 'center', backgroundColor: '#F7F7F7', borderRadius: 12, padding: 12 }
statValue: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' }
statLabel: { fontSize: 11, color: '#6B6B6B', marginTop: 2 }

EDIT BUTTON (secondary):
editBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#5DBB8E', borderRadius: 22, height: 44, paddingHorizontal: 16, gap: 6 }
PencilSimple size={16} color="#5DBB8E"
editBtnText: { fontSize: 14, color: '#5DBB8E', fontWeight: '500' }
*/
// filepath: src/screens/profile/MyProfileScreen.tsx
```

---

##### Screen 2 of 3: Edit Profile Screen
**File:** `src/screens/profile/EditProfileScreen.tsx` | **Duration:** 4h

**Design Specs:**
- Heading: "Edit Profile" — 24px semibold
- Avatar upload: same as MyProfileScreen (96px circle, `Camera` overlay)
- Display name input: filled, `User` icon left (20px, `#6B6B6B`)
- Bio textarea: filled, 100px min height, no icon
- Location row: filled, `MapPin` icon left (20px, `#5DBB8E`)
- "Save Changes" — green pill, 52px, sticky bottom

**AI Prompt:**
```typescript
/*
TASK: Redesign EditProfileScreen — VISUAL ONLY
DO NOT CHANGE: profile update handler, avatar upload, validation, navigation
ONLY CHANGE: StyleSheet, icons → Phosphor

import { User, Camera, MapPin } from 'phosphor-react-native';

All inputs: same filled style as auth screens (#F0F0F0, borderRadius 12, height 52)
Bio textarea: backgroundColor '#F0F0F0', borderRadius 12, minHeight 100, textAlignVertical 'top', padding 16
SAVE BUTTON: backgroundColor '#5DBB8E', borderRadius 26, height 52, width '100%'
*/
// filepath: src/screens/profile/EditProfileScreen.tsx
```

---

##### Screen 3 of 3: Public Seller Profile Screen
**File:** `src/screens/profile/SellerProfileScreen.tsx` | **Duration:** 4h

**Design Specs:**
- Same avatar/name/verified layout as MyProfileScreen
- Rating row: `Star` icons (16px, `#F59E0B` fill for rated, `#E0E0E0` outline for unrated), rating number (16px semibold), review count (14px `#6B6B6B`)
- "Follow" button: green pill, 44px, `UserPlus` icon left (16px, white)  
  → When following: secondary outlined, "Following" label, `Check` icon (16px, `#5DBB8E`)
- Active listings grid: 2-column ItemCard grid
- Reviews section: reviewer avatar (32px), name (14px semibold), date (12px `#999999`), `Star` rating row, review text (14px `#6B6B6B`)

**AI Prompt:**
```typescript
/*
TASK: Redesign SellerProfileScreen — VISUAL ONLY
DO NOT CHANGE: follow toggle handler, listings fetch, review fetch, navigation
ONLY CHANGE: StyleSheet, icons → Phosphor

import { Star, UserPlus, Check, ShieldCheck, MapPin } from 'phosphor-react-native';

STAR RATING ROW (do not change rating value logic):
Star size={16} — filled: color '#F59E0B' weight="fill", empty: color '#E0E0E0' weight="regular"
ratingNumber: { fontSize: 16, fontWeight: '600', color: '#1A1A1A' }
reviewCount: { fontSize: 14, color: '#6B6B6B' }

FOLLOW BUTTON (not following):
followBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#5DBB8E', borderRadius: 22, height: 44, paddingHorizontal: 16, gap: 6 }
UserPlus size={16} color="#FFFFFF"

FOLLOW BUTTON (following — do NOT change toggle logic):
followingBtn: { borderWidth: 1, borderColor: '#5DBB8E', borderRadius: 22, height: 44 }
Check size={16} color="#5DBB8E"

REVIEW ROW:
reviewAvatar: { width: 32, height: 32, borderRadius: 16 }
reviewDate: { fontSize: 12, color: '#999999' }
reviewText: { fontSize: 14, color: '#6B6B6B', lineHeight: 20 }
*/
// filepath: src/screens/profile/SellerProfileScreen.tsx
```

---

##### Screen 4 of 4: Badges Screen
**File:** `src/screens/profile/BadgesScreen.tsx` | **Duration:** 2h

**Design Specs:**
- Heading: "Badges" — 24px semibold, 24px horizontal padding
- Earned badge cell: `Medal` icon (28px, `#F59E0B`) or badge image, label (13px semibold, `#1A1A1A`), `#FFF9EC` bg, 12px radius — full opacity
- Locked badge cell: same icon (28px, `#CCCCCC`), label (13px, `#999999`), `#F7F7F7` bg, 12px radius — 60% opacity
- Grid: 3 columns, 12px gap, 16px horizontal padding
- Tap earned badge → detail modal: badge name (18px semibold), description (14px `#6B6B6B`), unlock date (12px `#999999`)
- Tap locked badge → detail modal: unlock criteria (14px `#6B6B6B`), `Lock` icon (24px, `#CCCCCC`) at top
- Modal: bottom sheet style, white, 24px padding, 16px top radius

**AI Prompt:**
```typescript
/*
TASK: Redesign BadgesScreen — VISUAL ONLY
DO NOT CHANGE: badge data fetch, earned/locked state logic, navigation
ONLY CHANGE: StyleSheet, icons → Phosphor

import { Medal, Lock } from 'phosphor-react-native';

GRID LAYOUT:
badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16 }
badgeCell (earned): { width: '30%', alignItems: 'center', backgroundColor: '#FFF9EC', borderRadius: 12, padding: 16, gap: 6 }
badgeCell (locked): { width: '30%', alignItems: 'center', backgroundColor: '#F7F7F7', borderRadius: 12, padding: 16, gap: 6, opacity: 0.6 }

Medal size={28} color="#F59E0B" — earned (do NOT change earned/locked condition)
Medal size={28} color="#CCCCCC" — locked

badgeLabel (earned): { fontSize: 13, fontWeight: '600', color: '#1A1A1A', textAlign: 'center' }
badgeLabel (locked): { fontSize: 13, color: '#999999', textAlign: 'center' }

DETAIL MODAL (bottom sheet — do NOT change modal open/close logic):
modalContainer: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 24 }
badgeName: { fontSize: 18, fontWeight: '600', color: '#1A1A1A', textAlign: 'center', marginBottom: 8 }
badgeDescription: { fontSize: 14, color: '#6B6B6B', textAlign: 'center', lineHeight: 20 }
unlockDate: { fontSize: 12, color: '#999999', textAlign: 'center', marginTop: 8 }
unlockCriteria: { fontSize: 14, color: '#6B6B6B', textAlign: 'center', lineHeight: 20 }
Lock size={24} color="#CCCCCC" — locked modal only
*/
// filepath: src/screens/profile/BadgesScreen.tsx
```

---

#### ✅ Acceptance Criteria — FLOW-15 (Visual Only)

- [ ] Avatar is 96px circle, `#F0F0F0` background
- [ ] Camera overlay is a 28px green circle (`#5DBB8E`) bottom-right of avatar, `Camera` icon white (14px)
- [ ] `ShieldCheck` (16px, `#5DBB8E`) appears inline after name on verified profiles
- [ ] Stats row shows 3 chips on `#F7F7F7` background, 12px radius
- [ ] "Edit Profile" is secondary outlined (border `#5DBB8E`), NOT filled, `PencilSimple` icon
- [ ] Edit profile inputs use filled style (`#F0F0F0`, 12px radius, no border)
- [ ] Bio textarea is filled, min 100px height
- [ ] "Save Changes" is green pill (52px), sticky bottom
- [ ] Seller profile star ratings: `#F59E0B` fill for rated, `#E0E0E0` outline for unrated
- [ ] "Follow" button: green filled pill, `UserPlus` (white) icon left
- [ ] "Following" state: secondary outlined, `Check` (green) icon left — NOT filled
- [ ] Badges grid: 3 columns, earned cells `#FFF9EC` bg + `#F59E0B` `Medal` icon, locked cells `#F7F7F7` + gray `Medal` + 60% opacity
- [ ] Badge detail modal: bottom sheet style, 16px top radius, white background
- [ ] Locked badge modal shows `Lock` (24px, `#CCCCCC`) — earned modal does NOT

---
---

### TASK FLOW-16: Home Dashboard

**Duration:** 8 hours  
**Priority:** P0 (Critical) — Daily active use  
**Screens:** 1 total  
**Asset Dependencies:** `House`, `Bell`, `Coins`, `Storefront`, `ArrowsLeftRight`, `TrendUp`, `Package`, `Lightning`, `Sparkle`, `MagnifyingGlass`

---

> **🚫 FROZEN — UI REDESIGN SCOPE ONLY**
>
> Do NOT change: dashboard data fetch, notification count, SP balance display logic, navigation to any section, any business logic.
>
> **Only modify:** `StyleSheet` values · icon imports → Phosphor · layout JSX · colors · spacing

---

#### Description
Redesign the Home Dashboard — the central hub users land on after login. It must feel like a dashboard: fast to scan, shows key metrics at a glance (SP balance, active trades, recent listings), and surfaces relevant actions quickly.

#### Scope — Files to Modify

| # | Screen | File | Change Type |
|---|--------|------|-------------|
| 1 | Home Dashboard | `src/screens/home/HomeScreen.tsx` | Restyle only |

---

##### Screen 1 of 1: Home Dashboard Screen
**File:** `src/screens/home/HomeScreen.tsx` | **Duration:** 8h

**Design Specs:**
- Header row: avatar (40px circle) + "Good morning, [Name]" (16px, `#1A1A1A`) + `Bell` icon (24px, `#1A1A1A`) with red unread badge
- SP balance strip: `#5DBB8E` bg, `Coins` (20px, white) + "[N] SP" (18px bold white) + "Earn More →" link (14px white)
- Quick actions row: 4 icon tiles — "Sell" (`Storefront`), "Trade" (`ArrowsLeftRight`), "Discover" (`MagnifyingGlass`), "My Trades" (`Package`) — 60×60px white cards, 12px radius, icon 28px `#5DBB8E`, label 12px `#1A1A1A`
- "Nearby Items" section: 2-column grid of ItemCard components, section header with "See All" link (`#5DBB8E`)
- "Active Trades" strip: horizontal scroll, trade preview cards (80px wide, thumbnail + status badge)
- Flash sale / Featured banner (if present): `Lightning` (16px, `#F59E0B`) badge, 12px radius card

**AI Prompt:**
```typescript
/*
TASK: Redesign HomeScreen — VISUAL ONLY
DO NOT CHANGE: data fetch hooks, navigation calls, notification count, SP balance source, any business logic
ONLY CHANGE: StyleSheet, icons → Phosphor, layout

import { House, Bell, Coins, Storefront, ArrowsLeftRight, MagnifyingGlass, Package, Lightning } from 'phosphor-react-native';

HEADER:
headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }
greetingText: { fontSize: 16, color: '#1A1A1A', flex: 1 }
notifButton: { position: 'relative' }
Bell size={24} color="#1A1A1A"
notifBadge: { position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: '#E85D75' }

SP STRIP:
spStrip: { backgroundColor: '#5DBB8E', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 8 }
Coins size={20} color="#FFFFFF"
spBalance: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', flex: 1 }
earnMoreText: { fontSize: 14, color: '#FFFFFF', opacity: 0.9 }

QUICK ACTION TILE:
actionTile: { flex: 1, alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4 }
actionIcon: size 28, color '#5DBB8E'
actionLabel: { fontSize: 12, color: '#1A1A1A', fontWeight: '500', marginTop: 6 }

SECTION HEADER:
sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }
sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A1A' }
seeAllText: { fontSize: 14, color: '#5DBB8E' }

ITEM GRID: 2-column FlatList, same as DiscoverScreen (12px gap, 16px padding)
TRADE PREVIEW CARD: { width: 80, marginRight: 8 } — thumbnail + status badge
*/
// filepath: src/screens/home/HomeScreen.tsx
```

---

#### ✅ Acceptance Criteria — FLOW-16 (Visual Only)

- [ ] Header avatar is 40px circle
- [ ] `Bell` icon (24px, `#1A1A1A`) has a small red dot badge (`#E85D75`) when unread notifications exist
- [ ] SP balance strip has `#5DBB8E` background, white text, `Coins` icon (20px, white)
- [ ] 4 quick action tiles are white cards (12px radius, subtle shadow), icons 28px `#5DBB8E`
- [ ] Section headers have "See All" in `#5DBB8E` green, right-aligned
- [ ] Nearby items grid is 2-column, 12px gap, 16px padding — same as DiscoverScreen
- [ ] Flash sale / featured banner has `Lightning` icon (16px, `#F59E0B`)
- [ ] Zero Ionicons imports in HomeScreen.tsx

---
---

### TASK FLOW-17: Notifications

**Duration:** 6 hours  
**Priority:** P1 (High) — Re-engagement  
**Screens:** 2 total  
**Asset Dependencies:** `Bell`, `ArrowsLeftRight`, `Storefront`, `ChatCircle`, `Coins`, `ShieldCheck`, `Check`, `Trash`

---

> **🚫 FROZEN — UI REDESIGN SCOPE ONLY**
>
> Do NOT change: notification data fetch, mark-as-read logic, mark-all-read handler, navigation from notifications, delete handler.
>
> **Only modify:** `StyleSheet` values · icon imports → Phosphor · layout JSX · colors · spacing

---

#### Description
Redesign the 2 notification screens. The Notifications List is an inbox — unread rows visually distinct from read rows. The Settings screen controls which push notifications are enabled using toggle switches.

#### Scope — Files to Modify

| # | Screen | File | Change Type |
|---|--------|------|-------------|
| 1 | Notifications List | `src/screens/notifications/NotificationsScreen.tsx` | Restyle only |
| 2 | Notification Settings | `src/screens/notifications/NotificationSettingsScreen.tsx` | Restyle only |

---

##### Screen 1 of 2: Notifications List Screen
**File:** `src/screens/notifications/NotificationsScreen.tsx` | **Duration:** 4h

**Design Specs:**
- Header: "Notifications" (20px semibold) + "Mark All Read" link (`#5DBB8E`, right-aligned)
- Notification rows (type-based icon in 40px circle):
  - Trade update: `ArrowsLeftRight` (20px, `#5DBB8E`) on `#E8F5F0` circle bg
  - New message: `ChatCircle` (20px, `#5DBB8E`) on `#E8F5F0` bg
  - SP earned: `Coins` (20px, `#F59E0B`) on `#FEF3C7` bg
  - Listing sold: `Storefront` (20px, `#5DBB8E`) on `#E8F5F0` bg
  - Safety alert: `ShieldCheck` (20px, `#E85D75`) on `#FEE2E2` bg
- Unread row: `#F7F7F7` background, title **bold**
- Read row: white background, title regular weight
- Timestamp: 12px, `#999999`, right-aligned
- Swipe-to-delete (if implemented): `Trash` icon, `#E85D75` bg action
- Empty state: `Bell` (64px, `#E0E0E0`) + "You're all caught up!"

**AI Prompt:**
```typescript
/*
TASK: Redesign NotificationsScreen — VISUAL ONLY
DO NOT CHANGE: mark-as-read handler, delete handler, navigation on row tap, data fetch
ONLY CHANGE: StyleSheet, icons → Phosphor

import { Bell, ArrowsLeftRight, ChatCircle, Coins, Storefront, ShieldCheck, Trash } from 'phosphor-react-native';

NOTIFICATION ROW:
notifRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 }
notifRowUnread: { backgroundColor: '#F7F7F7' }
notifRowRead: { backgroundColor: '#FFFFFF' }

ICON CIRCLE (type-based):
iconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' }
iconCircleTrade: { backgroundColor: '#E8F5F0' }  — ArrowsLeftRight size={20} color="#5DBB8E"
iconCircleMessage: { backgroundColor: '#E8F5F0' } — ChatCircle size={20} color="#5DBB8E"
iconCircleSP: { backgroundColor: '#FEF3C7' }      — Coins size={20} color="#F59E0B"
iconCircleSale: { backgroundColor: '#E8F5F0' }    — Storefront size={20} color="#5DBB8E"
iconCircleAlert: { backgroundColor: '#FEE2E2' }   — ShieldCheck size={20} color="#E85D75"

notifTitle: { fontSize: 14, color: '#1A1A1A' }
notifTitleUnread: { fontWeight: '600' }
notifTime: { fontSize: 12, color: '#999999' }

EMPTY STATE: Bell size={64} color="#E0E0E0"
MARK ALL READ: fontSize 14, color '#5DBB8E' — DO NOT change the handler
*/
// filepath: src/screens/notifications/NotificationsScreen.tsx
```

---

##### Screen 2 of 2: Notification Settings Screen
**File:** `src/screens/notifications/NotificationSettingsScreen.tsx` | **Duration:** 2h

**Design Specs:**
- Heading: "Notification Settings" — 20px semibold
- Settings rows: label (15px, `#1A1A1A`) + subtext (13px, `#6B6B6B`) + toggle right
- Toggle ON: `ToggleRight` icon (28px, `#5DBB8E`) OR native Switch with `trackColor={{ true: '#5DBB8E' }}`
- Toggle OFF: `ToggleLeft` icon (28px, `#E0E0E0`) OR native Switch default
- Section dividers: 1px `#F0F0F0`

**AI Prompt:**
```typescript
/*
TASK: Redesign NotificationSettingsScreen — VISUAL ONLY
DO NOT CHANGE: toggle state handlers, push notification permission calls, settings save logic
ONLY CHANGE: StyleSheet, Switch colors

// For React Native Switch (preserve the value and onValueChange props exactly):
<Switch
  value={setting.enabled}           // DO NOT CHANGE
  onValueChange={setting.onToggle}  // DO NOT CHANGE
  trackColor={{ false: '#E0E0E0', true: '#5DBB8E' }}  // CHANGE THIS
  thumbColor="#FFFFFF"                                  // CHANGE THIS
/>

SETTINGS ROW:
settingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' }
settingLabel: { fontSize: 15, color: '#1A1A1A', fontWeight: '500' }
settingSubtext: { fontSize: 13, color: '#6B6B6B', marginTop: 2 }
*/
// filepath: src/screens/notifications/NotificationSettingsScreen.tsx
```

---

#### ✅ Acceptance Criteria — FLOW-17 (Visual Only)

- [ ] Unread notification rows have `#F7F7F7` background and bold title
- [ ] Read rows have white background and regular weight title
- [ ] Icon circles are 40px, type-specific color (green/gold/red) — NOT all the same color
- [ ] Trade, message, sale icon circles use `#E8F5F0` (green tint) background
- [ ] SP icon circle uses `#FEF3C7` (gold tint) background
- [ ] Safety alert icon circle uses `#FEE2E2` (red tint) background
- [ ] "Mark All Read" is a text link in `#5DBB8E` — NOT a button
- [ ] Empty state: `Bell` (64px, `#E0E0E0`) + "You're all caught up!"
- [ ] Notification Settings switches use `trackColor={{ false: '#E0E0E0', true: '#5DBB8E' }}`
- [ ] Settings rows have 1px `#F0F0F0` bottom dividers

---

---

### TASK FLOW-19: Help & Support

**Duration:** 6 hours  
**Priority:** P1 (High) — Trust & retention  
**Screens:** 2 total  
**Asset Dependencies:** `Question`, `ChatCircle`, `EnvelopeSimple`, `CaretRight`, `MagnifyingGlass`, `ArrowLeft`

---

> **🚫 FROZEN — UI REDESIGN SCOPE ONLY**
>
> Do NOT change: FAQ data source, search handler, support ticket submission, navigation.
>
> **Only modify:** `StyleSheet` values · icon imports → Phosphor · layout JSX · colors · spacing

---

#### Description
Redesign the 2 Help & Support screens. The FAQ list must be scannable with clear category groupings. The Contact Support screen uses the same filled-input pattern as auth.

#### Scope — Files to Modify

| # | Screen | File | Change Type |
|---|--------|------|-------------|
| 1 | Help / FAQ | `src/screens/support/HelpScreen.tsx` | Restyle only |
| 2 | Contact Support | `src/screens/support/ContactSupportScreen.tsx` | Restyle only |

---

##### Screen 1 of 2: Help / FAQ Screen
**File:** `src/screens/support/HelpScreen.tsx` | **Duration:** 3h

**Design Specs:**
- Header: "Help & Support" — 20px semibold
- Search bar: filled style (`#F0F0F0`, 12px radius, 48px height), `MagnifyingGlass` icon left (20px, `#999999`), placeholder "Search help articles…"
- Category chips: horizontal scroll row, pill chips — selected: `#5DBB8E` bg, white text; unselected: `#F0F0F0` bg, `#6B6B6B` text
- FAQ rows: `Question` icon (16px, `#5DBB8E`) left, question text (15px, `#1A1A1A`), `CaretRight` (16px, `#999999`) right
- Section dividers: 1px `#F0F0F0`
- "Contact Us" sticky footer button: green pill, 52px, `ChatCircle` icon (18px, white) left

**AI Prompt:**
```typescript
/*
TASK: Redesign HelpScreen — VISUAL ONLY
DO NOT CHANGE: search logic, FAQ data, accordion open/close handler, navigation
ONLY CHANGE: StyleSheet, icons → Phosphor

import { MagnifyingGlass, Question, CaretRight, ChatCircle } from 'phosphor-react-native';

SEARCH BAR:
searchWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0F0', borderRadius: 12, height: 48, paddingHorizontal: 12, gap: 8 }
MagnifyingGlass size={20} color="#999999"
searchInput: { flex: 1, fontSize: 15, color: '#1A1A1A' }

CATEGORY CHIP:
chipActive: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#5DBB8E' }
chipInactive: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F0F0F0' }
chipTextActive: { fontSize: 14, color: '#FFFFFF', fontWeight: '500' }
chipTextInactive: { fontSize: 14, color: '#6B6B6B' }

FAQ ROW:
faqRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', gap: 10 }
Question size={16} color="#5DBB8E"
faqText: { flex: 1, fontSize: 15, color: '#1A1A1A' }
CaretRight size={16} color="#999999"

FOOTER BUTTON:
footerBtn: { flexDirection: 'row', backgroundColor: '#5DBB8E', borderRadius: 26, height: 52, alignItems: 'center', justifyContent: 'center', gap: 8 }
ChatCircle size={18} color="#FFFFFF"
*/
// filepath: src/screens/support/HelpScreen.tsx
```

---

##### Screen 2 of 2: Contact Support Screen
**File:** `src/screens/support/ContactSupportScreen.tsx` | **Duration:** 3h

**Design Specs:**
- Heading: "Contact Support" — 20px semibold
- Subject input: filled, label "SUBJECT", `EnvelopeSimple` icon left (20px, `#6B6B6B`)
- Message textarea: filled, label "MESSAGE", 120px min height, no icon
- Category picker row (if present): filled style, `CaretRight` right
- "Send Message" button: green pill, 52px, full width
- Below button: "Or email us at support@passitup.com" — 13px, `#6B6B6B`, centered; email in `#5DBB8E`

**AI Prompt:**
```typescript
/*
TASK: Redesign ContactSupportScreen — VISUAL ONLY
DO NOT CHANGE: form submission handler, validation, navigation
ONLY CHANGE: StyleSheet, icons → Phosphor

import { EnvelopeSimple } from 'phosphor-react-native';

SUBJECT INPUT: same filled style as LoginScreen email field
MESSAGE TEXTAREA:
textareaWrapper: { backgroundColor: '#F0F0F0', borderRadius: 12, minHeight: 120, paddingHorizontal: 16, paddingTop: 14 }
textarea: { fontSize: 16, color: '#1A1A1A', textAlignVertical: 'top' }

SUBMIT BUTTON: backgroundColor '#5DBB8E', borderRadius 26, height 52
EMAIL LINK TEXT: fontSize 13, color '#6B6B6B', textAlign 'center'
emailHighlight: { color: '#5DBB8E' }
*/
// filepath: src/screens/support/ContactSupportScreen.tsx
```

---

#### ✅ Acceptance Criteria — FLOW-19 (Visual Only)

- [ ] Search bar is filled style (`#F0F0F0`, 12px radius, 48px), `MagnifyingGlass` icon left
- [ ] Active category chip: `#5DBB8E` bg, white text; inactive: `#F0F0F0` bg, `#6B6B6B` text
- [ ] FAQ rows: `Question` (16px, `#5DBB8E`) left, `CaretRight` (16px, `#999999`) right
- [ ] "Contact Us" footer button: green pill, 52px, `ChatCircle` (18px, white) icon
- [ ] Contact form subject input: filled, `EnvelopeSimple` icon left
- [ ] Message textarea: filled, min 120px, `textAlignVertical: 'top'`
- [ ] "Send Message": green pill, 52px
- [ ] Email address below button is `#5DBB8E` green within a gray sentence

---
---

### TASK FLOW-21: ID Verification

**Duration:** 5 hours  
**Priority:** P1 (High) — Trust & safety  
**Screens:** 1 total  
**Asset Dependencies:** `IdentificationCard`, `Camera`, `CheckCircle`, `Clock`, `WarningCircle`, `ArrowRight`

---

> **🚫 FROZEN — UI REDESIGN SCOPE ONLY**
>
> Do NOT change: document upload handler, verification status fetch, navigation, any ID check logic.
>
> **Only modify:** `StyleSheet` values · icon imports → Phosphor · layout JSX · colors · spacing

---

#### Description
Redesign the ID Verification screen. Users submit a government ID photo to unlock higher trust levels. The screen has three visual states — Unverified, Pending Review, and Verified — each with a distinct color treatment.

#### Scope — Files to Modify

| # | Screen | File | Change Type |
|---|--------|------|-------------|
| 1 | ID Verification | `src/screens/verification/IDVerificationScreen.tsx` | Restyle only |

---

##### Screen 1 of 1: ID Verification Screen
**File:** `src/screens/verification/IDVerificationScreen.tsx` | **Duration:** 5h

**Design Specs:**

**State A — Unverified:**
- `IdentificationCard` icon: 64px, `#6B6B6B`, centered
- Heading: "Verify Your Identity" — 24px semibold, centered
- Subtext: 15px, `#6B6B6B`, centered, `lineHeight 22`
- Upload area: dashed border (`#E0E0E0`, 2px, 12px radius), 160px height, `Camera` (28px, `#5DBB8E`) centered, "Tap to upload ID photo" (14px, `#6B6B6B`)
- "Submit for Verification" button: green pill, 52px (disabled / gray if no file selected)

**State B — Pending Review:**
- `Clock` icon: 64px, `#F59E0B`, centered
- Heading: "Verification Pending" — 24px semibold
- Subtext: "We'll review your ID within 24–48 hours" — 15px, `#6B6B6B`
- Status pill: `#FEF3C7` bg, `#F59E0B` text, "Under Review" label — 8px radius, centered

**State C — Verified:**
- `CheckCircle` icon: 64px, `#5DBB8E`, centered
- Heading: "Identity Verified" — 24px semibold, `#5DBB8E`
- Status pill: `#E8F5F0` bg, `#5DBB8E` text, "Verified ✓" — 8px radius, centered

**AI Prompt:**
```typescript
/*
TASK: Redesign IDVerificationScreen — VISUAL ONLY
DO NOT CHANGE: upload handler, status fetch, navigation, any verification logic
ONLY CHANGE: StyleSheet, icons → Phosphor

import { IdentificationCard, Camera, CheckCircle, Clock, WarningCircle } from 'phosphor-react-native';

STATE-DRIVEN RENDERING (do not change the condition logic — only the JSX/styles inside each branch):

STATE A (unverified):
IdentificationCard size={64} color="#6B6B6B"
uploadArea: { borderWidth: 2, borderColor: '#E0E0E0', borderStyle: 'dashed', borderRadius: 12, height: 160, justifyContent: 'center', alignItems: 'center', gap: 8 }
Camera size={28} color="#5DBB8E"
uploadText: { fontSize: 14, color: '#6B6B6B' }
submitBtn: { backgroundColor: hasFile ? '#5DBB8E' : '#E0E0E0', borderRadius: 26, height: 52 }

STATE B (pending):
Clock size={64} color="#F59E0B"
statusPill: { backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, alignSelf: 'center' }
statusPillText: { fontSize: 13, color: '#F59E0B', fontWeight: '500' }

STATE C (verified):
CheckCircle size={64} color="#5DBB8E"
headingVerified: { color: '#5DBB8E' }
statusPillVerified: { backgroundColor: '#E8F5F0' }
statusPillTextVerified: { color: '#5DBB8E' }
*/
// filepath: src/screens/verification/IDVerificationScreen.tsx
```

---

#### ✅ Acceptance Criteria — FLOW-21 (Visual Only)

- [ ] Unverified state: `IdentificationCard` (64px, `#6B6B6B`), dashed upload area, submit button gray when no file
- [ ] Upload area: dashed `#E0E0E0` border, 2px, 12px radius, 160px height, `Camera` (28px, `#5DBB8E`) centered
- [ ] Submit button becomes `#5DBB8E` when a file is selected (preserve the existing disabled state logic)
- [ ] Pending state: `Clock` (64px, `#F59E0B`), gold status pill (`#FEF3C7` bg, `#F59E0B` text)
- [ ] Verified state: `CheckCircle` (64px, `#5DBB8E`), green heading, green status pill (`#E8F5F0` bg)
- [ ] All 3 states are centered layout (`alignItems: 'center'`)
- [ ] Zero Ionicons/MaterialIcons imports in IDVerificationScreen.tsx

---
---

### TASK FLOW-22: Payouts

**Duration:** 8 hours  
**Priority:** P1 (High) — SP monetisation  
**Screens:** 2 total  
**Asset Dependencies:** `Coins`, `Bank`, `CreditCard`, `ArrowDown`, `CheckCircle`, `Clock`, `CaretRight`, `Plus`

---

> **🚫 FROZEN — UI REDESIGN SCOPE ONLY**
>
> Do NOT change: payout request handler, bank account fetch, transaction history fetch, navigation, any payout business logic.
>
> **Only modify:** `StyleSheet` values · icon imports → Phosphor · layout JSX · colors · spacing

---

#### Description
Redesign the 2 Payout screens. The Payout Dashboard shows SP balance, connected bank account, and payout history. The Request Payout screen uses the filled-input pattern for amount entry.

#### Scope — Files to Modify

| # | Screen | File | Change Type |
|---|--------|------|-------------|
| 1 | Payout Dashboard | `src/screens/payouts/PayoutDashboardScreen.tsx` | Restyle only |
| 2 | Request Payout | `src/screens/payouts/RequestPayoutScreen.tsx` | Restyle only |

---

##### Screen 1 of 2: Payout Dashboard Screen
**File:** `src/screens/payouts/PayoutDashboardScreen.tsx` | **Duration:** 4h

**Design Specs:**
- Balance hero card: `#5DBB8E` bg, full width, 12px radius; `Coins` (24px, white) + "SP Balance" label (13px, white, 0.7 opacity) + "[N] SP" (32px bold white); "≈ $[X] AUD" (14px, white, 0.8 opacity) below
- "Request Payout" button: white pill on green card, `#5DBB8E` text, 44px, `ArrowDown` icon left (16px, `#5DBB8E`)
- Bank account row: `Bank` (20px, `#5DBB8E`), account name (15px, `#1A1A1A`), masked number (13px, `#6B6B6B`), `CaretRight` (16px, `#999999`) right; tap navigates to edit
- "Add Bank Account" row (if none): `Plus` (20px, `#5DBB8E`) left, "Add Bank Account" (15px, `#5DBB8E`), `CaretRight` right
- Payout History section: rows with status icon + amount + date
  - Completed: `CheckCircle` (16px, `#5DBB8E`)
  - Pending: `Clock` (16px, `#F59E0B`)

**AI Prompt:**
```typescript
/*
TASK: Redesign PayoutDashboardScreen — VISUAL ONLY
DO NOT CHANGE: payout data fetch, bank account data, navigation
ONLY CHANGE: StyleSheet, icons → Phosphor

import { Coins, Bank, ArrowDown, CaretRight, Plus, CheckCircle, Clock } from 'phosphor-react-native';

BALANCE HERO CARD:
heroCard: { backgroundColor: '#5DBB8E', borderRadius: 12, padding: 20, marginHorizontal: 16, marginTop: 16 }
Coins size={24} color="#FFFFFF"
balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 }
balanceAmount: { fontSize: 32, fontWeight: '700', color: '#FFFFFF', marginTop: 2 }
balanceAUD: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 }

REQUEST BUTTON (on card):
requestBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 22, height: 44, paddingHorizontal: 16, gap: 6, alignSelf: 'flex-start', marginTop: 16 }
ArrowDown size={16} color="#5DBB8E"
requestBtnText: { fontSize: 14, fontWeight: '600', color: '#5DBB8E' }

BANK ROW:
bankRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', gap: 10 }
Bank size={20} color="#5DBB8E"

HISTORY ROW (status icon driven — do not change condition logic):
CheckCircle size={16} color="#5DBB8E" — completed
Clock size={16} color="#F59E0B" — pending
*/
// filepath: src/screens/payouts/PayoutDashboardScreen.tsx
```

---

##### Screen 2 of 2: Request Payout Screen
**File:** `src/screens/payouts/RequestPayoutScreen.tsx` | **Duration:** 4h

**Design Specs:**
- Heading: "Request Payout" — 20px semibold
- Amount input: filled style, label "AMOUNT (SP)", `Coins` icon left (20px, `#F59E0B`), `fontSize 20` for the value
- Available balance line: "Available: [N] SP" — 13px, `#6B6B6B` below input
- Bank account selector row: filled style, `Bank` icon left (20px, `#5DBB8E`), `CaretRight` right — tap opens sheet (do NOT change logic)
- Summary row: "You'll receive ≈ $X AUD" — 14px, `#1A1A1A`, bold amount
- Fee note: 13px, `#999999`, centered
- "Confirm Payout" button: green pill, 52px, full width

**AI Prompt:**
```typescript
/*
TASK: Redesign RequestPayoutScreen — VISUAL ONLY
DO NOT CHANGE: payout submission handler, amount validation, bank account selector, fee calculation, navigation
ONLY CHANGE: StyleSheet, icons → Phosphor

import { Coins, Bank, CaretRight } from 'phosphor-react-native';

AMOUNT INPUT:
inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0F0', borderRadius: 12, height: 52, paddingHorizontal: 16 }
Coins size={20} color="#F59E0B"
amountInput: { flex: 1, fontSize: 20, fontWeight: '600', color: '#1A1A1A' }

AVAILABLE LINE: { fontSize: 13, color: '#6B6B6B', marginTop: 6 }

BANK SELECTOR (acts like an input row — do not change navigation/sheet logic):
bankRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0F0', borderRadius: 12, height: 52, paddingHorizontal: 16, gap: 10 }
Bank size={20} color="#5DBB8E"
CaretRight size={16} color="#999999"

SUMMARY: { fontSize: 14, color: '#1A1A1A' } bold amount value
FEE NOTE: { fontSize: 13, color: '#999999', textAlign: 'center' }
CONFIRM BUTTON: backgroundColor '#5DBB8E', borderRadius 26, height 52
*/
// filepath: src/screens/payouts/RequestPayoutScreen.tsx
```

---

#### ✅ Acceptance Criteria — FLOW-22 (Visual Only)

- [ ] Balance hero card: `#5DBB8E` bg, `Coins` (24px, white), balance value 32px bold white
- [ ] "Request Payout" is a white pill on the green card — NOT a separate full-width button
- [ ] Bank row: `Bank` (20px, `#5DBB8E`), `CaretRight` (16px, `#999999`) right
- [ ] Payout history: `CheckCircle` (16px, `#5DBB8E`) for completed, `Clock` (16px, `#F59E0B`) for pending
- [ ] Amount input: `Coins` (20px, `#F59E0B`), 20px font for value, filled style
- [ ] Bank selector looks like a filled input row, `Bank` + `CaretRight`
- [ ] "Confirm Payout": green pill, 52px, full width
- [ ] Fee note: 13px, `#999999`, centered

---

---

### TASK FLOW-13: Referrals

**Duration:** 5 hours  
**Priority:** P2 (Medium) — Growth mechanic  
**Screens:** 1 total  
**Asset Dependencies:** `Gift`, `Copy`, `Users`, `ShareNetwork`, `CheckCircle`, `Coins`

---

> **🚫 FROZEN — UI REDESIGN SCOPE ONLY**
>
> Do NOT change: referral code fetch, share handler, referral history data, SP award logic, navigation.
>
> **Only modify:** `StyleSheet` values · icon imports → Phosphor · layout JSX · colors · spacing

---

#### Description
Redesign the Referrals screen. It shows the user's unique referral code, sharing options, earned SP from referrals, and a list of successful referrals. The SP reward amount should visually pop using the gold accent.

#### Scope — Files to Modify

| # | Screen | File | Change Type |
|---|--------|------|-------------|
| 1 | Referrals | `src/screens/referrals/ReferralsScreen.tsx` | Restyle only |

---

##### Screen 1 of 1: Referrals Screen
**File:** `src/screens/referrals/ReferralsScreen.tsx` | **Duration:** 5h

**Design Specs:**
- Hero card: `#5DBB8E` bg, `Gift` (32px, white), "Refer Friends, Earn SP" (18px bold white), subtext (14px white, 0.8 opacity)
- Referral code box: `#FFFFFF` bg, 12px radius, 8px border `#E0E0E0`, code text (20px, `#1A1A1A`, `letterSpacing 4`, monospace), `Copy` icon right (20px, `#5DBB8E`)
- "Share" button: green pill, 52px, `ShareNetwork` icon left (18px, white)
- SP earned strip: `#FEF3C7` bg, `Coins` (20px, `#F59E0B`), "You've earned [N] SP from referrals" (14px, `#1A1A1A`, bold N)
- Referral history list: avatar (36px circle), name (15px semibold), "Joined [date]" (13px `#6B6B6B`), `CheckCircle` (16px, `#5DBB8E`) right + "+[N] SP" (13px, `#F59E0B`, semibold)
- Empty state: `Users` (64px, `#E0E0E0`) + "No referrals yet — share your code!"

**AI Prompt:**
```typescript
/*
TASK: Redesign ReferralsScreen — VISUAL ONLY
DO NOT CHANGE: referral code value, copy handler, share handler, history data fetch, navigation
ONLY CHANGE: StyleSheet, icons → Phosphor

import { Gift, Copy, Users, ShareNetwork, CheckCircle, Coins } from 'phosphor-react-native';

HERO CARD:
heroCard: { backgroundColor: '#5DBB8E', borderRadius: 16, padding: 20, margin: 16, alignItems: 'center', gap: 8 }
Gift size={32} color="#FFFFFF"
heroTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' }
heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center' }

REFERRAL CODE BOX:
codeBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E0E0E0', paddingHorizontal: 16, paddingVertical: 14, marginHorizontal: 16, gap: 10 }
codeText: { flex: 1, fontSize: 20, color: '#1A1A1A', letterSpacing: 4, fontWeight: '600' }
Copy size={20} color="#5DBB8E" — tap calls existing copy handler (DO NOT change)

SHARE BUTTON:
shareBtn: { flexDirection: 'row', backgroundColor: '#5DBB8E', borderRadius: 26, height: 52, alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 12 }
ShareNetwork size={18} color="#FFFFFF"

SP EARNED STRIP:
spStrip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 16, gap: 8 }
Coins size={20} color="#F59E0B"
spText: { fontSize: 14, color: '#1A1A1A' }

REFERRAL ROW:
referralRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 }
referralAvatar: { width: 36, height: 36, borderRadius: 18 }
referralName: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' }
referralDate: { fontSize: 13, color: '#6B6B6B' }
CheckCircle size={16} color="#5DBB8E"
spEarned: { fontSize: 13, color: '#F59E0B', fontWeight: '600' }

EMPTY STATE: Users size={64} color="#E0E0E0"
*/
// filepath: src/screens/referrals/ReferralsScreen.tsx
```

---

#### ✅ Acceptance Criteria — FLOW-13 (Visual Only)

- [ ] Hero card: `#5DBB8E` bg, `Gift` (32px, white), white text, 16px radius
- [ ] Referral code box: white bg, `#E0E0E0` border, 20px code text with `letterSpacing 4`, `Copy` (20px, `#5DBB8E`) right
- [ ] "Share" button: green pill 52px, `ShareNetwork` (18px, white) left
- [ ] SP earned strip: `#FEF3C7` bg, `Coins` (20px, `#F59E0B`), bold SP count
- [ ] Referral history rows: `CheckCircle` (16px, `#5DBB8E`) + "+[N] SP" in `#F59E0B`
- [ ] Empty state: `Users` (64px, `#E0E0E0`)
- [ ] Zero Ionicons/MaterialIcons imports

---
---

### TASK FLOW-25: Legal & Settings

**Duration:** 9 hours  
**Priority:** P2 (Medium) — Compliance & UX  
**Screens:** 5 total  
**Asset Dependencies:** `CaretRight`, `Lock`, `FileText`, `Shield`, `Gear`, `Sun`, `Moon`, `Translate`, `SignOut`, `Trash`, `WarningCircle`

---

> **🚫 FROZEN — UI REDESIGN SCOPE ONLY**
>
> Do NOT change: settings save handlers, sign-out logic, account delete handler, navigation, any preference logic.
>
> **Only modify:** `StyleSheet` values · icon imports → Phosphor · layout JSX · colors · spacing

---

#### Description
Redesign 4 settings/legal screens. All are list-based — clean rows with icons, labels, and either a chevron (navigate) or switch (toggle). Legal content screens (Terms, Privacy) are plain scrollable text with a simple header.

#### Scope — Files to Modify

| # | Screen | File | Change Type |
|---|--------|------|-------------|
| 1 | Settings | `src/screens/settings/SettingsScreen.tsx` | Restyle only |
| 2 | Privacy Policy | `src/screens/legal/PrivacyPolicyScreen.tsx` | Restyle only |
| 3 | Terms of Service | `src/screens/legal/TermsOfServiceScreen.tsx` | Restyle only |
| 4 | Account Deletion | `src/screens/settings/DeleteAccountScreen.tsx` | Restyle only |
| 5 | Liability Disclaimer | `src/screens/settings/LiabilityDisclaimerScreen.tsx` | Restyle only |

---

##### Screen 1 of 4: Settings Screen
**File:** `src/screens/settings/SettingsScreen.tsx` | **Duration:** 3h

**Design Specs:**
- Section groups with gray section headers (12px uppercase `#6B6B6B`, `#F7F7F7` bg row)
- Settings rows: left icon (20px, `#5DBB8E`) + label (15px, `#1A1A1A`) + `CaretRight` (16px, `#999999`) OR Switch
- Appearance row: `Sun`/`Moon` (20px) icon, "Appearance" label, `CaretRight`
- Language row: `Translate` (20px, `#5DBB8E`), "Language" label
- Privacy row: `Lock` (20px, `#5DBB8E`)
- Terms row: `FileText` (20px, `#5DBB8E`)
- "Sign Out" row: `SignOut` (20px, `#E85D75`), label `#E85D75` — NOT a button, just a red row
- "Delete Account" row: `Trash` (20px, `#E85D75`), label `#E85D75`
- Row dividers: 1px `#F0F0F0`, inset left by icon width

**AI Prompt:**
```typescript
/*
TASK: Redesign SettingsScreen — VISUAL ONLY
DO NOT CHANGE: sign-out handler, navigation calls, switch handlers, any logic
ONLY CHANGE: StyleSheet, icons → Phosphor

import { Lock, FileText, Shield, Gear, Sun, Moon, Translate, SignOut, Trash, CaretRight } from 'phosphor-react-native';

SECTION HEADER:
sectionHeader: { fontSize: 12, fontWeight: '500', color: '#6B6B6B', textTransform: 'uppercase', backgroundColor: '#F7F7F7', paddingHorizontal: 16, paddingVertical: 8 }

SETTINGS ROW (navigable):
settingsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0', gap: 12 }
rowIcon: size 20 — green (#5DBB8E) for most, red (#E85D75) for destructive
rowLabel: { flex: 1, fontSize: 15, color: '#1A1A1A' }
rowLabelDestructive: { flex: 1, fontSize: 15, color: '#E85D75' }
CaretRight size={16} color="#999999"

SWITCH ROW: same row, Switch replaces CaretRight
Switch trackColor={{ false: '#E0E0E0', true: '#5DBB8E' }} thumbColor="#FFFFFF"
*/
// filepath: src/screens/settings/SettingsScreen.tsx
```

---

##### Screen 2 of 4: Privacy Policy Screen
**File:** `src/screens/legal/PrivacyPolicyScreen.tsx` | **Duration:** 2h

**Design Specs:**
- Header: "Privacy Policy" — 20px semibold, back arrow left
- "Last updated: [date]" — 13px, `#999999`
- Scrollable body: section headings (17px semibold, `#1A1A1A`, `marginTop 24`), body text (15px, `#6B6B6B`, `lineHeight 24`)
- No interactive elements — read-only

**AI Prompt:**
```typescript
/*
TASK: Redesign PrivacyPolicyScreen — VISUAL ONLY
DO NOT CHANGE: content text, navigation
ONLY CHANGE: StyleSheet typography and spacing

HEADING STYLE: { fontSize: 17, fontWeight: '600', color: '#1A1A1A', marginTop: 24, marginBottom: 8 }
BODY TEXT: { fontSize: 15, color: '#6B6B6B', lineHeight: 24 }
LAST UPDATED: { fontSize: 13, color: '#999999', marginBottom: 16 }
SCROLL PADDING: paddingHorizontal 20, paddingBottom 40
*/
// filepath: src/screens/legal/PrivacyPolicyScreen.tsx
```

---

##### Screen 3 of 4: Terms of Service Screen
**File:** `src/screens/legal/TermsOfServiceScreen.tsx` | **Duration:** 1h

**Design Specs:** Identical to PrivacyPolicyScreen — same typography and spacing rules.

**AI Prompt:**
```typescript
/*
TASK: Redesign TermsOfServiceScreen — VISUAL ONLY
Apply identical StyleSheet as PrivacyPolicyScreen.
DO NOT CHANGE: content, navigation.
*/
// filepath: src/screens/legal/TermsOfServiceScreen.tsx
```

---

##### Screen 4 of 4: Delete Account Screen
**File:** `src/screens/settings/DeleteAccountScreen.tsx` | **Duration:** 2h

**Design Specs:**
- `Trash` icon: 64px, `#E85D75`, centered
- Heading: "Delete Account?" — 24px semibold, `#1A1A1A`
- Warning text: 15px, `#6B6B6B`, centered, `lineHeight 22`
- Consequences list: `X` (14px, `#E85D75`) per item (e.g. "All listings deleted", "SP balance lost")
- Password confirmation input: filled style, `Lock` icon left (20px, `#6B6B6B`)
- "Delete My Account" — red pill (52px, `#E85D75` bg, white text)
- "Cancel" — 14px, `#6B6B6B`, text link

**AI Prompt:**
```typescript
/*
TASK: Redesign DeleteAccountScreen — VISUAL ONLY
DO NOT CHANGE: delete handler, password confirmation logic, navigation
ONLY CHANGE: StyleSheet, icons → Phosphor

import { Trash, X, Lock } from 'phosphor-react-native';

Trash size={64} color="#E85D75" — centered
heading: { fontSize: 24, fontWeight: '600', color: '#1A1A1A', textAlign: 'center', marginTop: 16 }
warningText: { fontSize: 15, color: '#6B6B6B', textAlign: 'center', lineHeight: 22 }

CONSEQUENCE ROW: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }
X size={14} color="#E85D75"
consequenceText: { fontSize: 14, color: '#1A1A1A' }

PASSWORD INPUT: same filled style as auth screens (#F0F0F0, borderRadius 12, height 52)
Lock size={20} color="#6B6B6B"

DELETE BUTTON: backgroundColor '#E85D75', borderRadius 26, height 52, width '100%'
CANCEL LINK: fontSize 14, color '#6B6B6B', textAlign 'center', paddingVertical 16
*/
// filepath: src/screens/settings/DeleteAccountScreen.tsx
```

---

##### Screen 5 of 5: Liability Disclaimer Screen
**File:** `src/screens/settings/LiabilityDisclaimerScreen.tsx` | **Duration:** 1h

**Design Specs:**
- `WarningCircle` icon: 48px, `#F59E0B`, centered at top — conveys caution (not error/red)
- Heading: "Liability Disclaimer" — 22px semibold, `#1A1A1A`, centered
- "Last updated: [date]" — 13px, `#999999`, centered
- Scrollable body: identical typography to PrivacyPolicyScreen (17px semibold section headings, 15px `#6B6B6B` body, `lineHeight 24`)
- No interactive elements — read-only (scroll + back only, no button)

**AI Prompt:**
```typescript
/*
TASK: Redesign LiabilityDisclaimerScreen — VISUAL ONLY
DO NOT CHANGE: content text, navigation
ONLY CHANGE: StyleSheet typography, spacing, and icon

import { WarningCircle } from 'phosphor-react-native';

HEADER ICON (centered):
WarningCircle size={48} color="#F59E0B" weight="fill"
iconContainer: { alignItems: 'center', paddingTop: 24, paddingBottom: 12 }

HEADING: { fontSize: 22, fontWeight: '600', color: '#1A1A1A', textAlign: 'center', marginBottom: 4 }
LAST UPDATED: { fontSize: 13, color: '#999999', textAlign: 'center', marginBottom: 16 }

SCROLL BODY (identical to PrivacyPolicyScreen):
SECTION HEADING: { fontSize: 17, fontWeight: '600', color: '#1A1A1A', marginTop: 24, marginBottom: 8 }
BODY TEXT: { fontSize: 15, color: '#6B6B6B', lineHeight: 24 }
SCROLL PADDING: paddingHorizontal 20, paddingBottom 40
*/
// filepath: src/screens/settings/LiabilityDisclaimerScreen.tsx
```

---

#### ✅ Acceptance Criteria — FLOW-25 (Visual Only)

- [ ] Settings section headers: `#F7F7F7` bg, 12px uppercase `#6B6B6B`
- [ ] All navigable rows: left icon (20px) + label + `CaretRight` (16px, `#999999`)
- [ ] Switch rows: `trackColor={{ false: '#E0E0E0', true: '#5DBB8E' }}`, white thumb
- [ ] "Sign Out" and "Delete Account" rows: icon + label both `#E85D75`
- [ ] Privacy Policy / Terms: section headings 17px semibold, body 15px `#6B6B6B`, `lineHeight 24`
- [ ] Delete Account: `Trash` (64px, `#E85D75`), consequences list uses `X` (14px, `#E85D75`)
- [ ] "Delete My Account" button: `#E85D75` bg (red pill) — NOT green
- [ ] "Cancel" is a text link — NOT a button
- [ ] Liability Disclaimer: `WarningCircle` (48px, `#F59E0B`, filled) centered at top — NOT red
- [ ] Liability Disclaimer body typography matches PrivacyPolicyScreen exactly
- [ ] No buttons or CTAs on Liability Disclaimer — read-only

---
---

### TASK FLOW-26: Misc / Edge-Case Screens

**Duration:** 12 hours  
**Priority:** P2 (Medium) — Completeness  
**Screens:** 6 total  
**Asset Dependencies:** `WifiX`, `SmileyMeh`, `MagnifyingGlassSlash`, `Spinner`, `CheckCircle`, `XCircle`, `HourglassHigh`, `WarningCircle`, `ArrowCounterClockwise`

---

> **🚫 FROZEN — UI REDESIGN SCOPE ONLY**
>
> Do NOT change: retry handlers, navigation, error state logic, loading animation logic.
>
> **Only modify:** `StyleSheet` values · icon imports → Phosphor · layout JSX · colors · spacing

---

#### Description
Redesign 6 utility/edge-case screens: offline error, empty states (search, generic), loading screen, action success/failure confirmations. These screens must feel consistent with the design system even though they are secondary flows.

#### Scope — Files to Modify

| # | Screen | File | Change Type |
|---|--------|------|-------------|
| 1 | Offline / No Connection | `src/screens/error/OfflineScreen.tsx` | Restyle only |
| 2 | Empty Search Results | `src/components/EmptySearchState.tsx` | Restyle only |
| 3 | Generic Empty State | `src/components/EmptyState.tsx` | Restyle only |
| 4 | Loading Screen | `src/screens/LoadingScreen.tsx` | Restyle only |
| 5 | Action Success Screen | `src/screens/feedback/SuccessScreen.tsx` | Restyle only |
| 6 | Action Failure Screen | `src/screens/feedback/ErrorScreen.tsx` | Restyle only |

---

##### Screen 1 of 6: Offline / No Connection Screen
**File:** `src/screens/error/OfflineScreen.tsx` | **Duration:** 2h

**Design Specs:**
- Centered layout, white bg
- `WifiX` (64px, `#E0E0E0`) centered
- Heading: "No Internet Connection" — 22px semibold, `#1A1A1A`
- Subtext: "Check your connection and try again" — 15px, `#6B6B6B`, centered
- "Try Again" button: green pill, 52px, `ArrowCounterClockwise` icon left (18px, white)

**AI Prompt:**
```typescript
/*
TASK: Redesign OfflineScreen — VISUAL ONLY
DO NOT CHANGE: retry handler, network state listener
ONLY CHANGE: StyleSheet, icons → Phosphor

import { WifiX, ArrowCounterClockwise } from 'phosphor-react-native';
WifiX size={64} color="#E0E0E0" — centered
heading: { fontSize: 22, fontWeight: '600', color: '#1A1A1A', textAlign: 'center', marginTop: 16 }
subtext: { fontSize: 15, color: '#6B6B6B', textAlign: 'center', lineHeight: 22, marginTop: 8 }
retryBtn: { flexDirection: 'row', backgroundColor: '#5DBB8E', borderRadius: 26, height: 52, alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24, width: '100%' }
ArrowCounterClockwise size={18} color="#FFFFFF"
*/
// filepath: src/screens/error/OfflineScreen.tsx
```

---

##### Screen 2 of 6: Empty Search Results
**File:** `src/components/EmptySearchState.tsx` | **Duration:** 1h

**Design Specs:**
- `MagnifyingGlassSlash` (56px, `#E0E0E0`) centered
- "No results for "[query]"" — 17px semibold, `#1A1A1A`, centered
- "Try different keywords or filters" — 14px, `#6B6B6B`, centered

**AI Prompt:**
```typescript
/*
TASK: Redesign EmptySearchState — VISUAL ONLY
DO NOT CHANGE: query prop, any parent handlers
ONLY CHANGE: StyleSheet, icons → Phosphor

import { MagnifyingGlassSlash } from 'phosphor-react-native';
MagnifyingGlassSlash size={56} color="#E0E0E0"
title: { fontSize: 17, fontWeight: '600', color: '#1A1A1A', textAlign: 'center', marginTop: 12 }
subtitle: { fontSize: 14, color: '#6B6B6B', textAlign: 'center', marginTop: 4 }
container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }
*/
// filepath: src/components/EmptySearchState.tsx
```

---

##### Screen 3 of 6: Generic Empty State Component
**File:** `src/components/EmptyState.tsx` | **Duration:** 1h

**Design Specs:**
- Accepts `icon`, `title`, `subtitle`, optional `actionLabel` + `onAction` as props
- Icon: 56px, `#E0E0E0` (passed as prop, no hardcoding)
- Title: 17px semibold, `#1A1A1A`
- Subtitle: 14px, `#6B6B6B`
- Action button (if `actionLabel` provided): green pill, 44px

**AI Prompt:**
```typescript
/*
TASK: Redesign EmptyState component — VISUAL ONLY
DO NOT CHANGE: prop interface, any parent logic
ONLY CHANGE: StyleSheet values

DESIGN:
container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 8 }
title: { fontSize: 17, fontWeight: '600', color: '#1A1A1A', textAlign: 'center' }
subtitle: { fontSize: 14, color: '#6B6B6B', textAlign: 'center', lineHeight: 20 }
actionBtn: { backgroundColor: '#5DBB8E', borderRadius: 22, height: 44, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center', marginTop: 8 }
actionBtnText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' }
*/
// filepath: src/components/EmptyState.tsx
```

---

##### Screen 4 of 6: Loading Screen
**File:** `src/screens/LoadingScreen.tsx` | **Duration:** 2h

**Design Specs:**
- White bg, centered
- App logo / emoji (80px) OR `Spinner` ActivityIndicator
- ActivityIndicator color: `#5DBB8E`
- "Loading…" — 15px, `#6B6B6B`, below indicator

**AI Prompt:**
```typescript
/*
TASK: Redesign LoadingScreen — VISUAL ONLY
DO NOT CHANGE: any loading logic or navigation
ONLY CHANGE: StyleSheet, ActivityIndicator color

<ActivityIndicator size="large" color="#5DBB8E" />
container: { flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', gap: 16 }
loadingText: { fontSize: 15, color: '#6B6B6B' }
*/
// filepath: src/screens/LoadingScreen.tsx
```

---

##### Screen 5 of 6: Action Success Screen
**File:** `src/screens/feedback/SuccessScreen.tsx` | **Duration:** 2h

**Design Specs:**
- `CheckCircle` (72px, `#5DBB8E`, fill weight) centered
- Title from props: 24px semibold, `#1A1A1A`, centered
- Subtitle from props: 15px, `#6B6B6B`, centered
- CTA button (from props): green pill, 52px

**AI Prompt:**
```typescript
/*
TASK: Redesign SuccessScreen — VISUAL ONLY
DO NOT CHANGE: navigation params, CTA handler, title/subtitle props
ONLY CHANGE: StyleSheet, icons → Phosphor

import { CheckCircle } from 'phosphor-react-native';
CheckCircle size={72} color="#5DBB8E" weight="fill"
container: { flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, gap: 12 }
title: { fontSize: 24, fontWeight: '600', color: '#1A1A1A', textAlign: 'center' }
subtitle: { fontSize: 15, color: '#6B6B6B', textAlign: 'center', lineHeight: 22 }
ctaBtn: { backgroundColor: '#5DBB8E', borderRadius: 26, height: 52, width: '100%', justifyContent: 'center', alignItems: 'center', marginTop: 16 }
*/
// filepath: src/screens/feedback/SuccessScreen.tsx
```

---

##### Screen 6 of 6: Action Failure / Error Screen
**File:** `src/screens/feedback/ErrorScreen.tsx` | **Duration:** 2h

**Design Specs:**
- `XCircle` (72px, `#E85D75`, fill weight) centered
- Title from props: 24px semibold, `#1A1A1A`, centered
- Error message from props: 15px, `#6B6B6B`, centered
- "Try Again" button: green pill, 52px, `ArrowCounterClockwise` icon (18px, white)
- "Go Back" — 14px, `#6B6B6B`, text link

**AI Prompt:**
```typescript
/*
TASK: Redesign ErrorScreen — VISUAL ONLY
DO NOT CHANGE: retry handler, navigation, error message props
ONLY CHANGE: StyleSheet, icons → Phosphor

import { XCircle, ArrowCounterClockwise } from 'phosphor-react-native';
XCircle size={72} color="#E85D75" weight="fill"
retryBtn: { flexDirection: 'row', backgroundColor: '#5DBB8E', borderRadius: 26, height: 52, width: '100%', alignItems: 'center', justifyContent: 'center', gap: 8 }
ArrowCounterClockwise size={18} color="#FFFFFF"
goBackLink: { fontSize: 14, color: '#6B6B6B', textAlign: 'center', paddingVertical: 16 }
*/
// filepath: src/screens/feedback/ErrorScreen.tsx
```

---

#### ✅ Acceptance Criteria — FLOW-26 (Visual Only)

- [ ] Offline screen: `WifiX` (64px, `#E0E0E0`), green "Try Again" pill with `ArrowCounterClockwise` icon
- [ ] Empty search: `MagnifyingGlassSlash` (56px, `#E0E0E0`), 17px semibold title
- [ ] Generic EmptyState: accepts icon/title/subtitle/action as props, no hardcoded icons
- [ ] Loading screen: `ActivityIndicator` color `#5DBB8E`, white background
- [ ] Success screen: `CheckCircle` (72px, `#5DBB8E`, fill), green CTA pill
- [ ] Error screen: `XCircle` (72px, `#E85D75`, fill), green "Try Again" pill, gray "Go Back" text link
- [ ] All screens: white `#FFFFFF` background, centered layout, 24px horizontal padding

---

---

### TASK 20: Reusable Component Library

**Duration:** 16 hours  
**Priority:** P0 (Critical) — Used by every screen in the module  
**Components:** 8 total  
**Asset Dependencies:** `Coins`, `MapPin`, `Tag`, `ArrowsLeftRight`, `Storefront`, `House`, `ChatCircle`, `Bell`, `User`

---

> **🚫 FROZEN — UI REDESIGN SCOPE ONLY**
>
> Do NOT change: prop interfaces, business logic inside components, data formatting functions, navigation calls from components.
>
> **Only modify:** `StyleSheet` values · icon imports → Phosphor · layout JSX · colors · spacing · shadow/elevation values

---

#### Description
Redesign the 8 shared components that are imported across every screen in the app. These must be completed **before** any screen-level tasks begin, since all screens depend on them. Each component has a precise visual spec — consistency here cascades across the entire app.

#### Scope — Files to Modify

| # | Component | File | Used By |
|---|-----------|------|---------|
| 1 | ItemCard | `src/components/ItemCard.tsx` | Discover, Profile, Home, Trade |
| 2 | SPBadge | `src/components/SPBadge.tsx` | Listings, Cart, Wallet, Profile |
| 3 | NodeBadge | `src/components/NodeBadge.tsx` | Listings, Discover, Profile |
| 4 | PriceTag | `src/components/PriceTag.tsx` | ItemCard, Cart, Checkout |
| 5 | SectionHeader | `src/components/SectionHeader.tsx` | Home, Profile, Discover |
| 6 | FilterChip | `src/components/FilterChip.tsx` | Discover, Search |
| 7 | ActionSheet | `src/components/ActionSheet.tsx` | Listings, Trade, Cart |
| 8 | BottomTabBar | `src/navigation/BottomTabBar.tsx` | App shell |

---

##### Component 1 of 8: ItemCard
**File:** `src/components/ItemCard.tsx` | **Duration:** 3h

**Design Specs:**
- White card, 12px radius, subtle shadow (`elevation 2`, `shadowOpacity 0.06`, `shadowRadius 4`)
- Thumbnail: top, 16px radius top corners only (`borderTopLeftRadius 12, borderTopRightRadius 12`), `aspectRatio 1`
- Condition badge: top-left absolute overlay — pill (8px radius), 12px white text, 10px horizontal padding
  - New: `#5DBB8E` bg
  - Like New: `#3B82F6` bg (blue)
  - Good: `#F59E0B` bg (gold)
  - Fair: `#6B7280` bg (gray)
- Body padding: 8px all sides
- Title: 14px semibold, `#1A1A1A`, 2 lines max
- PriceTag component below title
- SPBadge (if SP price set) below PriceTag
- NodeBadge bottom-left, `MapPin` (10px) inline

**AI Prompt:**
```typescript
/*
TASK: Redesign ItemCard component — VISUAL ONLY
DO NOT CHANGE: onPress handler, prop interface, image source logic, navigation
ONLY CHANGE: StyleSheet, icons → Phosphor

import { MapPin } from 'phosphor-react-native';

CARD:
card: { backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } }

CONDITION BADGE (absolute overlay — top-left):
conditionBadge: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 }
conditionText: { fontSize: 12, color: '#FFFFFF', fontWeight: '500' }
Colors: New '#5DBB8E' | LikeNew '#3B82F6' | Good '#F59E0B' | Fair '#6B7280'

BODY:
body: { padding: 8 }
title: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', numberOfLines: 2 }

THUMBNAIL:
thumbnail: { width: '100%', aspectRatio: 1, borderTopLeftRadius: 12, borderTopRightRadius: 12 }
*/
// filepath: src/components/ItemCard.tsx
```

---

##### Component 2 of 8: SPBadge
**File:** `src/components/SPBadge.tsx` | **Duration:** 1h

**Design Specs:**
- Pill shape: `#FEF3C7` bg, 20px radius, 6px vertical / 10px horizontal padding
- `Coins` icon: 12px, `#F59E0B`, left
- "[N] SP" text: 13px semibold, `#F59E0B`
- Gap between icon and text: 4px

**AI Prompt:**
```typescript
/*
TASK: Redesign SPBadge component — VISUAL ONLY
DO NOT CHANGE: value prop, any formatting logic
ONLY CHANGE: StyleSheet, icons → Phosphor

import { Coins } from 'phosphor-react-native';

badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, gap: 4, alignSelf: 'flex-start' }
Coins size={12} color="#F59E0B"
badgeText: { fontSize: 13, fontWeight: '600', color: '#F59E0B' }
*/
// filepath: src/components/SPBadge.tsx
```

---

##### Component 3 of 8: NodeBadge
**File:** `src/components/NodeBadge.tsx` | **Duration:** 1h

**Design Specs:**
- Pill shape: `#E8F5F0` bg, 20px radius, 4px vertical / 8px horizontal padding
- `MapPin` icon: 10px, `#5DBB8E`, left
- Node name text: 11px, `#5DBB8E`, semibold
- Gap: 3px

**AI Prompt:**
```typescript
/*
TASK: Redesign NodeBadge component — VISUAL ONLY
DO NOT CHANGE: nodeName prop, any location logic
ONLY CHANGE: StyleSheet, icons → Phosphor

import { MapPin } from 'phosphor-react-native';

badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5F0', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, gap: 3, alignSelf: 'flex-start' }
MapPin size={10} color="#5DBB8E"
badgeText: { fontSize: 11, fontWeight: '600', color: '#5DBB8E' }
*/
// filepath: src/components/NodeBadge.tsx
```

---

##### Component 4 of 8: PriceTag
**File:** `src/components/PriceTag.tsx` | **Duration:** 1h

**Design Specs:**
- Dollar amount: 16px bold, `#1A1A1A`
- If discounted: original price struck through (13px, `#999999`, `textDecorationLine: 'line-through'`) before the sale price
- "TRADE" label (if trade-only): `#5DBB8E` text, 11px semibold, `Tag` icon (10px, `#5DBB8E`) left, `#E8F5F0` bg pill

**AI Prompt:**
```typescript
/*
TASK: Redesign PriceTag component — VISUAL ONLY
DO NOT CHANGE: price props, formatting, trade flag logic
ONLY CHANGE: StyleSheet, icons → Phosphor

import { Tag } from 'phosphor-react-native';

price: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' }
originalPrice: { fontSize: 13, color: '#999999', textDecorationLine: 'line-through', marginRight: 4 }
tradePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5F0', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, gap: 3 }
Tag size={10} color="#5DBB8E"
tradeText: { fontSize: 11, fontWeight: '600', color: '#5DBB8E' }
*/
// filepath: src/components/PriceTag.tsx
```

---

##### Component 5 of 8: SectionHeader
**File:** `src/components/SectionHeader.tsx` | **Duration:** 1h

**Design Specs:**
- Row: `flexDirection 'row'`, `alignItems 'center'`, `justifyContent 'space-between'`
- Title: 16px semibold, `#1A1A1A`
- "See All" link (if `onSeeAll` prop provided): 14px, `#5DBB8E`
- Padding: `paddingHorizontal 16`, `paddingVertical 12`

**AI Prompt:**
```typescript
/*
TASK: Redesign SectionHeader component — VISUAL ONLY
DO NOT CHANGE: title prop, onSeeAll prop, any navigation in parent
ONLY CHANGE: StyleSheet

container: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }
title: { fontSize: 16, fontWeight: '600', color: '#1A1A1A' }
seeAll: { fontSize: 14, color: '#5DBB8E' }
*/
// filepath: src/components/SectionHeader.tsx
```

---

##### Component 6 of 8: FilterChip
**File:** `src/components/FilterChip.tsx` | **Duration:** 1h

**Design Specs:**
- Active (selected): `#5DBB8E` bg, white text, 20px radius
- Inactive: `#F0F0F0` bg, `#6B6B6B` text, 20px radius
- Height: 36px, padding: `paddingHorizontal 14`
- Text: 14px, `fontWeight '500'`

**AI Prompt:**
```typescript
/*
TASK: Redesign FilterChip component — VISUAL ONLY
DO NOT CHANGE: selected prop, onPress handler, label prop
ONLY CHANGE: StyleSheet

chipActive: { height: 36, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#5DBB8E', justifyContent: 'center', alignItems: 'center' }
chipInactive: { height: 36, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' }
textActive: { fontSize: 14, fontWeight: '500', color: '#FFFFFF' }
textInactive: { fontSize: 14, fontWeight: '500', color: '#6B6B6B' }
*/
// filepath: src/components/FilterChip.tsx
```

---

##### Component 7 of 8: ActionSheet
**File:** `src/components/ActionSheet.tsx` | **Duration:** 2h

**Design Specs:**
- Bottom sheet modal: white bg, `borderTopLeftRadius 20`, `borderTopRightRadius 20`
- Drag handle: 4px high, 36px wide, `#E0E0E0` bg, centered, `marginTop 12`, `borderRadius 2`
- Title row (optional): 16px semibold, `#1A1A1A`, `paddingHorizontal 20`, `paddingTop 16`
- Action rows: icon (20px, color by type) + label (15px) + `CaretRight` (if navigable)
  - Default: `#1A1A1A` label, `#5DBB8E` icon
  - Destructive: `#E85D75` label and icon
- Cancel row at bottom: 15px, `#6B6B6B`, centered, 52px height, `borderTopWidth 1`, `borderTopColor '#F0F0F0'`

**AI Prompt:**
```typescript
/*
TASK: Redesign ActionSheet component — VISUAL ONLY
DO NOT CHANGE: visible prop, onClose handler, actions array prop, any action handlers
ONLY CHANGE: StyleSheet, icons → Phosphor (the icon prop in each action item stays as-is — only the wrapper styles change)

sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 24 }
handle: { width: 36, height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, alignSelf: 'center', marginTop: 12 }
title: { fontSize: 16, fontWeight: '600', color: '#1A1A1A', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }

ACTION ROW:
actionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 12 }
actionLabel: { fontSize: 15, color: '#1A1A1A', flex: 1 }
actionLabelDestructive: { fontSize: 15, color: '#E85D75', flex: 1 }

CANCEL ROW:
cancelRow: { height: 52, justifyContent: 'center', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F0F0F0' }
cancelText: { fontSize: 15, color: '#6B6B6B' }
*/
// filepath: src/components/ActionSheet.tsx
```

---

##### Component 8 of 8: Bottom Tab Bar
**File:** `src/navigation/BottomTabBar.tsx` | **Duration:** 3h

**Design Specs:**
- White bg, `borderTopWidth 1`, `borderTopColor '#F0F0F0'`, no elevation
- 5 tabs: Home, Discover, Sell, Messages, Profile
- Active tab: icon `#5DBB8E`, label `#5DBB8E`, 12px semibold
- Inactive tab: icon `#999999`, label `#999999`, 12px regular
- Sell tab (center): `#5DBB8E` circle bg (52px), white `Storefront` icon (24px), no label — floating slightly above bar
- Tab icons (Phosphor, 24px):
  - Home: `House`
  - Discover: `MagnifyingGlass`
  - Sell: `Storefront` (in green circle)
  - Messages: `ChatCircle`
  - Profile: `User`
- Notification badge on Messages: same as notification badge spec (8px red dot)

**AI Prompt:**
```typescript
/*
TASK: Redesign BottomTabBar — VISUAL ONLY
DO NOT CHANGE: tab navigation logic, active route detection, badge count, any navigation.navigate() calls
ONLY CHANGE: StyleSheet, swap all existing icons → Phosphor

import { House, MagnifyingGlass, Storefront, ChatCircle, User } from 'phosphor-react-native';

TAB BAR:
tabBar: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingBottom: 20, paddingTop: 8 }

TAB ITEM:
tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 }
tabLabel: { fontSize: 12, color: '#999999' }
tabLabelActive: { fontSize: 12, color: '#5DBB8E', fontWeight: '600' }
Icon color inactive: '#999999' | active: '#5DBB8E' — size 24

SELL TAB (center, special):
sellTab: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#5DBB8E', justifyContent: 'center', alignItems: 'center', marginBottom: 8 }
Storefront size={24} color="#FFFFFF"
NO label for sell tab

NOTIFICATION BADGE on Messages:
badge: { position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: '#E85D75' }
*/
// filepath: src/navigation/BottomTabBar.tsx
```

---

#### ✅ Acceptance Criteria — Task 20 (Visual Only)

- [ ] **ItemCard**: white card, 12px radius, subtle shadow, condition badge top-left with correct color per condition level
- [ ] **SPBadge**: `#FEF3C7` bg pill, `Coins` (12px, `#F59E0B`), text `#F59E0B` semibold
- [ ] **NodeBadge**: `#E8F5F0` bg pill, `MapPin` (10px, `#5DBB8E`), text `#5DBB8E` semibold
- [ ] **PriceTag**: 16px bold `#1A1A1A`; trade pill shows `Tag` icon + `#E8F5F0` bg; struck-through original price `#999999`
- [ ] **SectionHeader**: row layout, 16px semibold title, "See All" in `#5DBB8E`
- [ ] **FilterChip**: active `#5DBB8E` bg / white text; inactive `#F0F0F0` bg / `#6B6B6B` text; 36px height
- [ ] **ActionSheet**: white bottom sheet, 20px top radius, drag handle centered, destructive rows in `#E85D75`, cancel row 52px
- [ ] **BottomTabBar**: Sell tab is 52px green circle (`#5DBB8E`) with white `Storefront` icon, floated above bar; active tabs green, inactive gray
- [ ] **BottomTabBar**: notification badge is 8px red dot (`#E85D75`) on Messages icon
- [ ] Zero Ionicons/MaterialIcons across all 8 components

---

## ✅ MODULE 15.1 COMPLETE

All 20 tasks covering 68 screens and 8 shared components are now fully specified.

**Implementation Order:**
1. **Task 20 first** — Reusable Component Library (all screens depend on these)
2. **Tasks 1–5** — P0 Critical flows (Auth, Onboarding, Node/ZIP, Listings, Discovery)
3. **Tasks 6–10** — P0/P1 flows (Cart, Trade, SP Wallet, Subscriptions, Messaging)
4. **Tasks 11–19** — P1/P2 flows (Profile, Dashboard, Notifications, Help, Verification, Payouts, Referrals, Settings, Misc)

**Definition of Done per task:**
- All acceptance criteria checkboxes pass via visual review on device/simulator
- Zero `Ionicons` / `MaterialIcons` imports in modified files
- No TypeScript errors introduced (`yarn typecheck` passes)
- No Supabase, navigation, or validation logic altered

---

## 🧩 REUSABLE COMPONENT LIBRARY

**Create these components BEFORE implementing any flow that uses them.**

| Component | File | Used By |
|-----------|------|---------|
| Button | `src/components/shared/Button.tsx` | All flows |
| TextInput | `src/components/shared/TextInput.tsx` | FLOW-01, 02, 03, 04 |
| ItemCard | `src/components/discovery/ItemCard.tsx` | FLOW-06, Dashboard |
| SPBadge | `src/components/shared/SPBadge.tsx` | FLOW-04, 06, 08 |
| StatusBadge | `src/components/shared/StatusBadge.tsx` | FLOW-04, 08, 12 |
| OTPInput | `src/components/auth/OTPInput.tsx` | FLOW-01 |
| SocialLoginButtons | `src/components/auth/SocialLoginButtons.tsx` | FLOW-01 |
| SearchBar | `src/components/shared/SearchBar.tsx` | FLOW-06 |
| DisclaimerModal | `src/components/shared/DisclaimerModal.tsx` | FLOW-08 |
| EmptyState | `src/components/shared/EmptyState.tsx` | All flows |

---

## 📊 IMPLEMENTATION ROADMAP

### Week 1 — P0 Auth, Onboarding, Discovery
- Install Phosphor Icons ✅, download Storyset illustrations
- Create component library (Button, TextInput, OTPInput, SocialLoginButtons)
- Implement FLOW-01 (Auth), FLOW-02 (Onboarding), FLOW-03 (Node/ZIP)

### Week 2 — P0 Listings, Cart, Trade
- Create components: ItemCard, SPBadge, StatusBadge, SearchBar
- Implement FLOW-04 (Listings), FLOW-06 (Discovery), FLOW-07 (Cart)

### Week 3 — P0/P1 Trade, Subscriptions
- Create components: DisclaimerModal, EmptyState
- Implement FLOW-08 (Trade), FLOW-12 (Subscriptions)

### Week 4 — P1/P2 Supporting Flows + Polish
- Implement FLOW-14 (Messaging), FLOW-10/11 (SP Wallet), Profile, Dashboard
- Implement all P2/P3 flows: Notifications, Help, Legal, Settings, Misc
- Accessibility audit + visual QA on iOS and Android

---

## ✅ GLOBAL VERIFICATION CHECKLIST

Before marking any task complete:

### Design System
- [ ] All icons from `phosphor-react-native` — zero legacy icon imports
- [ ] Primary color `#5DBB8E` used consistently — zero orange or off-brand colors
- [ ] All primary buttons: `height: 52`, `borderRadius: 26`
- [ ] All inputs: `backgroundColor: '#F0F0F0'`, `borderRadius: 12`, **no `borderWidth`**
- [ ] Typography: Inter/system font, 28px headings, 16px body, 13px labels

### Constraints (must remain unchanged)
- [ ] Zero supabase call modifications
- [ ] Zero form validation changes
- [ ] Zero navigation structure changes
- [ ] Zero state management changes
- [ ] Zero business logic changes

### Code Quality
- [ ] `yarn typecheck` passes with 0 errors
- [ ] `yarn lint` passes with 0 errors

### Accessibility
- [ ] All icon-only buttons have `accessibilityLabel`
- [ ] Touch targets minimum 44×44px

---

## 📚 REFERENCE DOCUMENTS

1. `design-system-passitup.md` — Full design specification
2. `screen-flow-mapping.md` — All 68 screens mapped to flows
3. `implementation-guide.md` — Icon catalog (Section 4), illustration inventory

---

**END OF MODULE 15.1 — Tasks 1–5 of 27**
