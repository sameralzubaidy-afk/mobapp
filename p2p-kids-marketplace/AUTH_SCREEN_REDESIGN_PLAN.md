# Auth Screen Redesign Implementation Plan

## Design System Requirements (from design-system.md)
- **Primary Color**: #4A7C59 (Sage green)
- **Accent Color**: #FF8C42 (Orange)
- **Secondary Color**: #5B8FB9 (Blue)
- **Font**: Inter (400, 500, 600, 700)
- **Button Height (Large)**: 56px
- **Button Height (Medium)**: 48px
- **Input Height**: 48px
- **Border Radius**: 12px (buttons/inputs), 16px (cards)
- **Social Login**: 48px height, white background, 1px border

## Screens to Update (FLOW-01)
1. ✅ LandingScreen.tsx — COMPLETE
2. ⏳ LoginScreen.tsx — IN PROGRESS
3. ⏳ SignupScreen.tsx — PENDING
4. ⏳ PhoneVerificationScreen.tsx — PENDING
5. ⏳ ForgotPasswordScreen.tsx — PENDING
6. ⏳ ResetPasswordScreen.tsx — PENDING
7. ⏳ SuspendedAccountScreen.tsx — PENDING

## Components to Update
1. ⏳ SocialLoginButtons.tsx — Use design-system styling
2. ⏳ PhoneVerificationModal.tsx — Use OTPInput component
3. ⏳ AccountLinkingPrompt.tsx — Use Modal + Button components
4. ⏳ SetPasswordModal.tsx — Use Modal + TextInput + Button

## Breaking Changes to Apply
- Remove all "Skip Auth" dev testing buttons
- Replace all hardcoded colors with theme tokens
- Replace TouchableOpacity with Button component
- Replace TextInput with UI TextInput component
- Use Inter font throughout (via theme.typography)

## Next: Batch Update Strategy
- Use multi_replace_string_in_file for efficiency
- Update imports first (add UI components, theme)
- Update JSX structure (Button, TextInput, layout)
- Update styles (theme tokens, no hardcoded colors)
- Test with Tier 0 (typecheck + lint)
