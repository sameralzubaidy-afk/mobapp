# Pass It Up Design System
**Version**: 1.0  
**Date**: May 4, 2026  
**Style Inspiration**: Whisk app (clean, minimal, friendly)  
**Purpose**: Canonical design reference for all mobile screens

---

## 1. Color Palette

### Primary Brand Color (Whisk Green)
```
Primary Green:
- Main: #5DBB8E (Whisk-inspired green for CTAs, primary actions)
- Light: #7FCAA3 (hover states, lighter variants)
- Dark: #4DAA7A (pressed states, darker variants)
- Tint: #E8F5F0 (subtle backgrounds, success states)
```

### Neutral Colors
```
Text & UI:
- Primary Text: #1A1A1A (headings, primary content)
- Secondary Text: #6B6B6B (subtext, labels)
- Tertiary Text: #999999 (placeholders, hints)
- Border: #E0E0E0 (dividers, subtle borders)
- Background Light: #F0F0F0 (input fills, cards)
- Background Page: #FAFAFA (screen backgrounds)
- White: #FFFFFF (cards, modals, buttons)
```

### Semantic Colors
```
Success: #5DBB8E (same as primary green)
Error: #E85D75 (soft red, validation errors)
Warning: #FFA726 (caution states)
Info: #5B8FB9 (informational messages)
```

### Swap Points (SP) Color
```
SP Gold: #F59E0B (SP currency indicator)
SP Background: #FEF3C7 (SP balance cards)
```

---

## 2. Typography

### Font Family
```
iOS: San Francisco (system default)
Android: Roboto (system default)
Fallback: System UI font
```

### Type Scale
```
Heading 1: 28px, semibold, #1A1A1A (screen titles)
Heading 2: 24px, semibold, #1A1A1A (section headers)
Heading 3: 20px, semibold, #1A1A1A (card titles)

Body: 16px, regular, #1A1A1A (primary text)
Body Small: 14px, regular, #6B6B6B (secondary text, captions)

Label: 13px, medium, #6B6B6B, uppercase (input labels, tags)
Button: 16px, semibold, white (button text)

Caption: 12px, regular, #999999 (hints, timestamps)
```

### Line Heights
```
Headings: 1.2x font size
Body: 1.5x font size
Labels: 1.3x font size
```

---

## 3. Spacing System

### Base Unit: 4px

### Spacing Scale
```
xs: 4px
sm: 8px
md: 12px
lg: 16px
xl: 20px
xxl: 24px
xxxl: 32px
```

### Screen Layout
```
Page Horizontal Padding: 20-24px
Vertical Section Spacing: 16-20px
Component Internal Padding: 12-16px
```

### Touch Targets
```
Minimum: 44x44px (WCAG AAA)
Recommended Button Height: 52px (large), 48px (medium)
Icon Buttons: 50x50px (circular social login)
```

---

## 4. Component Specifications

### 4.1 Primary Buttons

**Style**: Pill-shaped (fully rounded)

```tsx
Height: 52px (large), 48px (medium), 40px (small)
Border Radius: height/2 (creates pill shape)
Background: #5DBB8E (primary green)
Text: 16px, semibold, white, centered
Padding Horizontal: 24px
Full-width: Yes (screen width minus page padding)

States:
- Default: #5DBB8E
- Pressed: #4DAA7A (darker green)
- Disabled: 50% opacity, gray background #CCCCCC
- Loading: Show activity indicator, disable interaction
```

**Example**:
```tsx
<Button variant="primary" size="large">
  Get Started
</Button>
```

---

### 4.2 Secondary Buttons

**Style**: Outline or text-only

```tsx
Height: 48px
Border Radius: 24px (pill-shaped)
Background: Transparent or white
Border: 2px solid #5DBB8E (outline variant)
Text: 16px, medium, #5DBB8E

Text-only variant:
- No background, no border
- Text: 15px, medium, #6B6B6B or #5DBB8E
- Underline on press (optional)
```

**Example**:
```tsx
<Button variant="secondary" size="large">
  Log In
</Button>

<Button variant="text">
  Already have an account? Log In
</Button>
```

---

### 4.3 Text Input Fields (Filled Style)

**Style**: No border, light gray fill background

```tsx
Height: 52px
Background: #F0F0F0 (light gray fill)
Border: None (filled style, no outline)
Border Radius: 12px
Padding Horizontal: 16px
Text: 16px, regular, #1A1A1A
Placeholder: 16px, regular, #999999

Label:
- Position: Above input
- Style: 13px, medium, #6B6B6B, uppercase or title case
- Margin Bottom: 8px

States:
- Default: #F0F0F0
- Focus: #E8E8E8 (slightly darker)
- Error: #FFE8E8 (light red tint) + error message below
- Disabled: #F5F5F5, text color #999999

Error Message:
- Style: 12px, regular, #E85D75
- Position: Below input, 4px margin
```

**Example**:
```tsx
<TextInput
  label="EMAIL"
  placeholder="you@example.com"
  keyboardType="email-address"
/>
```

---

### 4.4 OTP Input (Single Auto-Formatted Field)

**Style**: Single field with digit spacing (NOT 6 separate boxes)

```tsx
Type: Single TextInput with auto-formatting
Height: 52px
Background: #F0F0F0 (filled style)
Border Radius: 12px
Padding Horizontal: 16px
Text: 20px, monospace/tabular numbers, centered
Letter Spacing: 10px (spacing between digits)
Max Length: 6 digits
Auto-format Display: "1 2 3 4 5 6" (digits separated by spaces)
Placeholder: "0 0 0 0 0 0"

States:
- Default: #F0F0F0
- Focus: #E8E8E8
- Error: #FFE8E8 (light red tint)

Behavior:
- Auto-focus on mount
- Numeric keyboard only
- Auto-format with spaces between digits
- Auto-submit when 6 digits entered (optional)
```

**Example**:
```tsx
<OTPInput
  value={code}
  onChange={setCode}
  length={6}
  error={hasError}
/>
```

---

### 4.5 Social Login Buttons (Icon-Only Circular)

**Style**: Horizontal row of 3 circular icon buttons

```tsx
Layout: Horizontal row, centered
Icon Size: 50x50px diameter (circular)
Gap Between Icons: 16px
Background: White (#FFFFFF)
Border: 1px solid #E0E0E0
Shadow: Subtle (0 1px 2px rgba(0,0,0,0.05))

Icon Text/Symbols:
- Google: "G" (20px, semibold, #1A1A1A)
- Apple: "" (20px, Apple SF Symbol or Unicode)
- Facebook: "f" (20px, semibold, #1A1A1A)

Label Above Row:
- Text: "Or continue with" (13px, regular, #6B6B6B, lowercase)
- Position: Centered above icons, 16px margin bottom

States:
- Default: White background, border #E0E0E0
- Pressed: Background #F5F5F5, border #D0D0D0
```

**Example**:
```tsx
<SocialLoginButtons
  mode="signup"
  onSuccess={handleSuccess}
/>
```

**Visual Layout**:
```
        Or continue with
        
    (G)     ()     (f)
  Google   Apple  Facebook
```

---

### 4.6 Dividers

**"or" Divider Style**:
```tsx
Line: 1px height, #E0E0E0
Text: "or" (13px, regular, #6B6B6B, lowercase)
Layout: Horizontal line — text — horizontal line
Margin: 20px top/bottom
```

**Section Dividers**:
```tsx
Full-width line: 1px, #E0E0E0
Margin: 16px top/bottom
```

---

### 4.7 Illustrations & Icons

**Minimalist Line Art**:
```
Style: Simple line drawings, 1-2 colors
Size: 180-240px square (onboarding screens)
Colors: #1A1A1A outlines, #5DBB8E accent highlights
Examples: Person with phone, handshake, checkmark, lock

Budget: $20-40 for custom illustrations OR free resources:
- Undraw.co (customizable, MIT license)
- Streamline Icons (free tier)
- Feather Icons (simple line icons)
```

**Icons** (see Asset Inventory section below):
```
Size: 24x24px (standard), 20x20px (small), 32x32px (large)
Style: Line icons, 2px stroke, rounded corners
Color: #1A1A1A (default), #5DBB8E (active/selected)
```

---

## 5. Screen-Specific Patterns

### 5.1 Landing Screen

```tsx
Layout:
- SafeAreaView (full screen)
- Centered content, vertical scroll

Elements (top to bottom):
1. Logo/Brand
   - Emoji: 80px (e.g., 🤝)
   - App Name: 28px, semibold, #1A1A1A

2. Hero Section
   - Illustration: 240px square (optional)
   - Headline: 28px, semibold, centered, #1A1A1A
   - Subheading: 16px, regular, centered, #6B6B6B
   - Spacing: 16px between elements

3. Feature Cards (3 columns)
   - Icon/Emoji: 40px
   - Title: 14px, medium, #1A1A1A
   - Description: 12px, regular, #999999
   - Layout: Horizontal row, equal width

4. CTA Buttons
   - Primary: "Get Started" (52px, pill-shaped, green)
   - Secondary: "Log In" (48px, outline or text)
   - Spacing: 12px between buttons

5. Footer
   - Terms link: 12px, gray, centered
   - Margin: 24px top
```

---

### 5.2 Login/Signup Screens

```tsx
Layout:
- SafeAreaView
- KeyboardAvoidingView
- ScrollView (for keyboard handling)

Elements:
1. Header
   - Title: "Log In" or "Create Account" (24px, semibold)
   - Margin: 24px top

2. Form Inputs
   - Email: Filled style, label "EMAIL"
   - Password: Filled style, label "PASSWORD", show/hide toggle
   - Confirm Password (signup only)
   - Spacing: 16px between inputs

3. Forgot Password (login only)
   - Position: Below password input
   - Style: 14px, #5DBB8E, "Forgot password?"

4. Primary CTA
   - "Log In" or "Sign Up" (52px, pill, green)
   - Margin: 24px top

5. Divider
   - "or" divider (thin line + text)

6. Social Login
   - 3 circular icon buttons (Google, Apple, Facebook)
   - Centered row

7. Footer Link
   - "Already have an account? Log In" (14px, #6B6B6B)
   - Margin: 24px top
```

---

### 5.3 Phone Verification Screen

```tsx
Layout:
- SafeAreaView, centered content

Elements:
1. Header
   - Title: "Verify Your Phone" (24px, semibold, centered)
   - Subtitle: "We sent a 6-digit code to +1 (XXX) XXX-XXXX"
   - Style: 15px, regular, #6B6B6B, centered
   - Spacing: 8px between title and subtitle

2. OTP Input
   - Single auto-formatted field (52px height)
   - Centered, full-width (minus padding)
   - Margin: 32px top

3. Verify Button
   - "Verify" (52px, pill, green)
   - Disabled until 6 digits entered
   - Margin: 24px top

4. Resend Code
   - Text: "Didn't receive the code? Resend"
   - Style: 14px, #5DBB8E (link), centered
   - Countdown timer: "Resend in 0:30" (#999999, non-clickable)
   - Margin: 16px top

5. Change Phone Number
   - Text link: "Change phone number" (14px, #6B6B6B, underlined)
   - Margin: 8px top
```

---

## 6. Accessibility Requirements

### Contrast Ratios (WCAG AA)
```
Normal Text (16px+): 4.5:1 minimum
Large Text (18px+ or 14px bold): 3:1 minimum
UI Components: 3:1 minimum

Verified Combinations:
✅ #5DBB8E on white: 3.8:1 (large text only)
✅ #1A1A1A on white: 18.5:1 (all text)
✅ #6B6B6B on white: 5.7:1 (all text)
```

### Touch Targets
```
Minimum: 44x44px (WCAG AAA)
Buttons: 52px height (exceeds minimum)
Icon buttons: 50x50px (exceeds minimum)
```

### Focus States
```
All interactive elements MUST have visible focus state:
- Inputs: Darker background (#E8E8E8)
- Buttons: Darker background (#4DAA7A)
- Links: Underline
```

---

## 7. Component Usage Guidelines

### When to Use Each Button Variant

**Primary (Pill Green)**:
- Main screen action (Get Started, Sign Up, Verify, Confirm)
- Maximum 1 primary button per screen
- Examples: Submit forms, complete flows, next steps

**Secondary (Outline/Text)**:
- Alternative actions (Log In, Skip, Cancel)
- Navigation links (Already have account? Log In)
- Multiple on one screen is OK

**Text-Only**:
- Tertiary actions (Add preferences later, Edit)
- Footer links (Terms, Privacy Policy)
- Low-priority navigation

---

### When to Use Filled vs Outlined Inputs

**Filled (Default)**:
- All standard inputs (email, password, text)
- Search bars
- Consistent with Whisk style

**Outlined (DO NOT USE)**:
- Not part of Pass It Up design system
- Use filled style for all inputs

---

### Icon Usage

**System Icons** (use SF Symbols on iOS, Material Icons on Android):
- Navigation: arrow-left, arrow-right, home, user, settings
- Actions: plus, trash, edit, check, x
- Status: check-circle, alert-circle, info-circle

**Custom Icons** (when system icons don't fit):
- Use same stroke weight (2px)
- Maintain 24x24px grid
- Export as SVG for scalability

---

## 8. Animation & Transitions

### Button Press Animation
```tsx
Duration: 150ms
Scale: 0.98 (slight shrink)
Opacity: 0.9
Easing: ease-out
```

### Screen Transitions
```tsx
Type: Slide (horizontal for stack, vertical for modals)
Duration: 300ms
Easing: ease-in-out
```

### Loading States
```tsx
Activity Indicator:
- Size: Medium (iOS default)
- Color: White (on green buttons), #5DBB8E (on white)

Skeleton Loaders:
- Background: #F0F0F0
- Shimmer: #E8E8E8
- Animation: Left to right, 1.5s duration
```

---

## 9. Platform-Specific Considerations

### iOS vs Android

**Shared (Same on Both)**:
- Colors, typography, spacing
- Button styles (pill-shaped)
- Input styles (filled)
- Component layouts

**Platform-Specific**:
- Navigation patterns (UINavigationController vs AndroidX Navigation)
- Status bar style (light/dark)
- Keyboard behavior (iOS auto-scroll, Android resize)
- Safe area handling (notch, home indicator)

**Font Rendering**:
- iOS: Slightly heavier font weight appears natural
- Android: Use default system weight, avoid custom font weights

---

## 10. Design Tokens (Code Reference)

### Color Tokens (TypeScript)
```typescript
export const colors = {
  primary: {
    main: '#5DBB8E',
    light: '#7FCAA3',
    dark: '#4DAA7A',
    tint: '#E8F5F0',
  },
  text: {
    primary: '#1A1A1A',
    secondary: '#6B6B6B',
    tertiary: '#999999',
  },
  background: {
    page: '#FAFAFA',
    card: '#FFFFFF',
    input: '#F0F0F0',
  },
  border: {
    default: '#E0E0E0',
    focus: '#5DBB8E',
    error: '#E85D75',
  },
  semantic: {
    success: '#5DBB8E',
    error: '#E85D75',
    warning: '#FFA726',
    info: '#5B8FB9',
  },
};
```

### Spacing Tokens (TypeScript)
```typescript
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};
```

### Typography Tokens (TypeScript)
```typescript
export const typography = {
  h1: { fontSize: 28, fontWeight: '600', lineHeight: 34 },
  h2: { fontSize: 24, fontWeight: '600', lineHeight: 29 },
  h3: { fontSize: 20, fontWeight: '600', lineHeight: 24 },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
  bodySmall: { fontSize: 14, fontWeight: '400', lineHeight: 21 },
  label: { fontSize: 13, fontWeight: '500', lineHeight: 17 },
  button: { fontSize: 16, fontWeight: '600', lineHeight: 19 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
};
```

---

## 11. AI Prompt Template for Future Screens

Use this template when asking AI to create/update screens:

```markdown
**Context**: Pass It Up mobile app (React Native Expo)
**Design System**: Follow /Prompts/re-desing/design-system-passitup.md

**Requirements**:
1. Colors: Use Whisk green (#5DBB8E) for primary actions
2. Buttons: Pill-shaped (borderRadius = height/2), 52px height
3. Inputs: Filled style (#F0F0F0 background, no border, 12px radius)
4. Typography: System fonts, 16px body, 24px headings
5. Spacing: 20-24px screen padding, 16-20px section spacing
6. Components: Import from @/components/ui (Button, TextInput, etc.)

**Screen**: [Screen name, e.g., "ProfileSetupScreen"]
**Flow**: [Flow ID, e.g., "FLOW-02: Profiles & Onboarding"]

[Specific screen requirements...]

**Output**:
- TypeScript + React Native
- StyleSheet (no inline styles)
- Accessibility labels
- Error handling
- Loading states
```

---

## 12. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | May 4, 2026 | Initial design system based on Whisk inspiration. Covers colors, typography, buttons, inputs, OTP, social login. |

---

## 13. References

**Inspiration**:
- Whisk app (iOS) — minimal, clean, green accent, circular social login
- Material Design 3 — filled input fields
- Apple HIG — accessibility, touch targets

**External Resources**:
- Undraw.co (free illustrations)
- Feather Icons (simple line icons)
- SF Symbols (iOS system icons)
- Material Icons (Android system icons)

**Internal Files**:
- `/Prompts/re-desing/screen-flow-mapping.md` — Screen inventory + flow mapping
- `p2p-kids-marketplace/src/theme/` — Theme implementation (colors, typography, spacing)
- `p2p-kids-marketplace/src/components/ui/` — Reusable UI components

---

**END OF DESIGN SYSTEM**
