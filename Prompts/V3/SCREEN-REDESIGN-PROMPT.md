# Agent Prompt: Scan & Restyle Legacy Screens
**Version**: 1.0  
**Date**: May 24, 2026  
**Purpose**: Copy-paste prompt to give your AI agent. Instructs it to find all legacy-styled screens and restyle them to the design system — without breaking any functionality.

---

## HOW TO USE THIS PROMPT

1. Open a new Copilot Agent chat
2. Copy the prompt block below (everything between the `---PROMPT START---` and `---PROMPT END---` markers)
3. Paste it as your first message
4. The agent will work screen by screen — review each diff before accepting

---PROMPT START---

# Task: Scan & Restyle All Legacy Screens

## Your Role
You are a senior React Native engineer and UX expert. Your task is a **pure restyling pass** — you must update the visual appearance of legacy screens to match the design system while preserving 100% of all business logic, navigation, data fetching, state management, and functionality.

## Ground Rules (NEVER violate these)
- ❌ DO NOT change any function signatures, hook calls, or API calls
- ❌ DO NOT rename props, state variables, or handler functions  
- ❌ DO NOT change navigation calls (`navigation.navigate`, `navigation.goBack`, etc.)
- ❌ DO NOT remove any JSX elements — only restyle them
- ❌ DO NOT modify test files
- ❌ DO NOT touch `.old.tsx` files
- ❌ DO NOT touch `src/screens/admin/` screens (separate admin UI)
- ✅ ONLY change: `StyleSheet.create({})` values, inline style objects, and add theme token imports

---

## Step 1: SCAN — Identify Legacy Screens

Scan every file in:
```
p2p-kids-marketplace/src/screens/
```
Exclude: `__tests__/`, `*.old.tsx`, `admin/`

### Legacy Screen Detection Rules

A screen is **LEGACY** if its `StyleSheet.create({})` or inline styles contain ANY of these patterns:

| Pattern | Legacy Signal | Correct Token |
|---------|--------------|---------------|
| `'#007AFF'` or `'#0066CC'` | iOS system blue | `theme.colors.primary[500]` |
| `'#333'` or `'#333333'` | Old dark text | `theme.textColors.primary` |
| `'#666'` or `'#666666'` | Old gray text | `theme.textColors.secondary` |
| `'#999'` or `'#999999'` | Old placeholder | `theme.textColors.tertiary` |
| `'#f9f9f9'` or `'#f5f5f5'` (input bg) | Old input fill | `theme.backgroundColors.input` |
| `'#fff'` or `'#ffffff'` (page bg) | Old page bg | `theme.backgroundColors.page` |
| `borderRadius: 8` (on buttons) | Old button radius | `theme.borderRadius.md` (12px) |
| `height: 48` or `height: 56` (buttons) | Old button height | 52px (large), 48px (medium) |
| `'#ff3b30'` or `'#E53935'` | Old error red | `theme.colors.error[500]` |
| `'#4CAF50'` | Old success green | `theme.colors.success[500]` |
| `'#FFA726'` | Old warning | `theme.colors.warning[500]` |
| No `import { theme }` at top | Theme not used | Add theme import |

### Output a prioritized list of legacy screens in this format:
```
LEGACY SCREENS FOUND:
1. src/screens/LoginScreen.tsx — reasons: hardcoded #007AFF, #333, borderRadius:8
2. src/screens/SignupScreen.tsx — reasons: hardcoded #fff as page bg, height:48 buttons
3. src/screens/trade/TradeListScreen.tsx — reasons: no theme import, hardcoded colors
... (complete list)

ALREADY UPDATED SCREENS (skip these):
- src/screens/auth/LoginScreen.tsx ✅
- src/screens/auth/SignupScreen.tsx ✅
... 

TOTAL: X legacy screens need updating
```

Do NOT start updating until you have listed all legacy screens and I confirm.

---

## Step 2: UPDATE — Restyle One Screen at a Time

After I confirm the list, update screens **one at a time** in priority order (most user-visible first: auth → home → trade → profile → subscription → support → edge cases).

For each screen, apply ALL of the following rules:

### 2.1 Theme Import
Add at the top of every updated file:
```typescript
import { theme } from '@/theme';
```
If it already imports from `@/theme`, ensure all tokens below are available.

### 2.2 Color Tokens — Replace All Hardcoded Colors

| Replace this hardcoded value | With this theme token |
|-----------------------------|-----------------------|
| `'#007AFF'`, `'#0066CC'`, `'#4A7C59'` | `theme.colors.primary[500]` |
| `'#3A5F47'`, `'#4DAA7A'` | `theme.colors.primary[600]` |
| `'#E8F3EC'`, `'#E8F5F0'` | `theme.colors.primary[100]` |
| `'#FF8C42'`, `'#FF6B35'` | `theme.colors.accent[500]` |
| `'#1A1A1A'`, `'#333'`, `'#333333'`, `'#222'` | `theme.textColors.primary` |
| `'#6B6B6B'`, `'#666'`, `'#666666'`, `'#4D4D4D'` | `theme.textColors.secondary` |
| `'#999999'`, `'#999'`, `'#808080'` | `theme.textColors.tertiary` |
| `'#5B8FB9'` | `theme.colors.secondary[500]` |
| `'#E85D75'`, `'#E53935'`, `'#ff3b30'`, `'#FF3B30'` | `theme.colors.error[500]` |
| `'#FFF0F2'`, `'#FFEBEE'` | `theme.colors.error[100]` |
| `'#4CAF50'` | `theme.colors.success[500]` |
| `'#FFA726'` | `theme.colors.warning[500]` |
| `'#F59E0B'` | `theme.colors.sp[500]` |
| `'#FEF3C7'` | `theme.colors.sp[100]` |
| `'#F0F0F0'` (input background) | `theme.backgroundColors.input` |
| `'#F7F7F7'`, `'#F5F5F5'`, `'#FAFAFA'`, `'#f9f9f9'` (page bg) | `theme.backgroundColors.page` |
| `'#FFFFFF'`, `'#fff'` (card/modal bg) | `theme.backgroundColors.card` |
| `'rgba(0, 0, 0, 0.4)'` (overlay) | `theme.backgroundColors.overlay` |
| `'#CCCCCC'`, `'#E0E0E0'` (borders) | `theme.borderColors.default` |

### 2.3 Button Styles
All primary action buttons must use:
```typescript
// PRIMARY BUTTON (pill-shaped)
button: {
  height: 52,
  borderRadius: 26,           // pill shape (height / 2)
  backgroundColor: theme.colors.primary[500],
  paddingHorizontal: theme.spacing.xxl,  // 24px
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
},
buttonText: {
  ...theme.typography.button,          // 16px, semibold
  color: theme.backgroundColors.card,  // white
},
// PRESSED STATE
buttonPressed: {
  backgroundColor: theme.colors.primary[600],
},
// DISABLED STATE  
buttonDisabled: {
  opacity: 0.5,
},

// SECONDARY BUTTON (outline)
buttonSecondary: {
  height: 48,
  borderRadius: 24,
  borderWidth: 2,
  borderColor: theme.colors.primary[500],
  backgroundColor: 'transparent',
  paddingHorizontal: theme.spacing.xxl,
},
buttonSecondaryText: {
  ...theme.typography.button,
  color: theme.colors.primary[500],
},
```

### 2.4 Input Styles (Filled — No Border)
All text inputs must use:
```typescript
inputContainer: {
  marginBottom: theme.spacing.lg,  // 16px
},
inputLabel: {
  ...theme.typography.label,              // 12px, medium
  color: theme.textColors.secondary,
  marginBottom: theme.spacing.sm,         // 8px
  textTransform: 'uppercase',
},
input: {
  height: 52,
  backgroundColor: theme.backgroundColors.input,  // #F0F0F0
  borderRadius: theme.borderRadius.md,             // 12px
  paddingHorizontal: theme.spacing.lg,             // 16px
  ...theme.typography.bodyLarge,                   // 16px regular
  color: theme.textColors.primary,
  // NO borderWidth, NO borderColor (filled style)
},
inputFocused: {
  backgroundColor: '#E8F5F0',  // slightly tinted on focus
},
inputError: {
  backgroundColor: theme.colors.error[100],
},
inputErrorText: {
  ...theme.typography.bodySmall,
  color: theme.colors.error[500],
  marginTop: theme.spacing.xs,  // 4px
},
```

### 2.5 Typography — Replace All Hardcoded Font Styles
```typescript
// REPLACE hardcoded font styles with theme tokens:
{ fontSize: 32, fontWeight: '700' }  →  theme.typography.h1
{ fontSize: 24, fontWeight: '700' }  →  theme.typography.h2
{ fontSize: 20, fontWeight: '600' }  →  theme.typography.h3
{ fontSize: 18, fontWeight: '600' }  →  theme.typography.h4
{ fontSize: 16, fontWeight: '400' }  →  theme.typography.bodyLarge
{ fontSize: 14, fontWeight: '400' }  →  theme.typography.body
{ fontSize: 12, fontWeight: '400' }  →  theme.typography.bodySmall
{ fontSize: 16, fontWeight: '600' }  →  theme.typography.button
{ fontSize: 12, fontWeight: '500' }  →  theme.typography.label
{ fontSize: 10, fontWeight: '400' }  →  theme.typography.caption
```

### 2.6 Spacing — Replace All Hardcoded Numbers
```typescript
// REPLACE hardcoded spacing values:
4   →  theme.spacing.xs
8   →  theme.spacing.sm
12  →  theme.spacing.md
16  →  theme.spacing.lg
20  →  theme.spacing.xl
24  →  theme.spacing.xxl
32  →  theme.spacing.xxxl
```

### 2.7 Border Radius
```typescript
// Available radius tokens:
theme.borderRadius.sm   // 8px  — small elements (chips, small cards)
theme.borderRadius.md   // 12px — inputs, cards, modals
theme.borderRadius.lg   // 16px — large cards
theme.borderRadius.xl   // 20px — bottom sheets
theme.borderRadius.full // 9999 — pill shapes (use for buttons instead)

// Pill buttons: use explicit height/2 value (26 for 52px button)
```

### 2.8 Shadows
```typescript
// Replace custom shadow objects with:
...theme.shadows.card    // { shadowColor, shadowOffset, shadowOpacity, shadowRadius, elevation }
...theme.shadows.modal
...theme.shadows.none
```

### 2.9 Screen Background
Every screen's root container should use:
```typescript
container: {
  flex: 1,
  backgroundColor: theme.backgroundColors.page,  // #F7F7F7
},
```

### 2.10 Icons — Replace Ionicons with Phosphor Icons
If the screen imports from `@expo/vector-icons` or `react-native-vector-icons`, replace with Phosphor:
```typescript
// REMOVE:
import { Ionicons } from '@expo/vector-icons';
<Ionicons name="arrow-back" size={24} color="#333" />

// REPLACE WITH:
import { ArrowLeft } from 'phosphor-react-native';
<ArrowLeft size={24} color={theme.textColors.primary} weight="regular" />
```

Icon name mapping reference:
| Ionicons name | Phosphor replacement |
|---------------|---------------------|
| `arrow-back` | `ArrowLeft` |
| `chevron-forward` | `CaretRight` |
| `close` | `X` |
| `search` | `MagnifyingGlass` |
| `heart` / `heart-outline` | `Heart` (fill / regular) |
| `star` / `star-outline` | `Star` (fill / regular) |
| `camera` | `Camera` |
| `image` | `Image` |
| `trash-outline` | `Trash` |
| `create-outline` / `pencil` | `PencilSimple` |
| `share-outline` | `Share` |
| `notifications-outline` | `Bell` |
| `settings-outline` | `Gear` |
| `person-outline` | `User` |
| `home-outline` | `House` |
| `chatbubble-outline` | `ChatCircle` |
| `cart-outline` | `ShoppingCart` |
| `wallet-outline` | `Wallet` |
| `checkmark-circle` | `CheckCircle` |
| `alert-circle` | `WarningCircle` |
| `information-circle` | `InfoCircle` |
| `eye` / `eye-off` | `Eye` / `EyeSlash` |
| `lock-closed-outline` | `Lock` |
| `location-outline` | `MapPin` |
| `time-outline` | `Clock` |
| `filter-outline` | `FunnelSimple` |
| `refresh-outline` | `ArrowClockwise` |
| `log-out-outline` | `SignOut` |

---

## Step 3: VALIDATE each updated screen

After updating each screen, confirm:
- [ ] `yarn typecheck` passes (no TypeScript errors introduced)
- [ ] `yarn lint` passes (no ESLint errors)
- [ ] No hardcoded hex colors remain (run: `grep -n "'#[0-9a-fA-F]'" src/screens/[ScreenName].tsx`)
- [ ] All button heights are 52px (primary) or 48px (secondary)
- [ ] All inputs use `backgroundColor: theme.backgroundColors.input` (no border)
- [ ] Screen background uses `theme.backgroundColors.page`
- [ ] All text styles use `theme.typography.*` tokens
- [ ] No `@expo/vector-icons` imports remain

After passing validation, show a **before/after summary** for the StyleSheet changes only (not logic).

---

## Step 4: PROGRESS REPORT

After completing all screens, output a final report:

```
RESTYLING COMPLETE
==================
Updated: X screens
Skipped (already updated): Y screens
Skipped (admin): Z screens

Screens updated:
✅ src/screens/LoginScreen.tsx
✅ src/screens/SignupScreen.tsx
... (full list)

Token coverage:
- Colors: 100% theme tokens (0 hardcoded hex values)
- Typography: 100% theme tokens
- Spacing: 100% theme tokens
- Buttons: 100% pill-shaped (52px / 48px)
- Inputs: 100% filled style (#F0F0F0)
- Icons: 100% Phosphor Icons

TypeScript: PASS
Lint: PASS
```

---PROMPT END---

---

## TIPS FOR BEST RESULTS

### Tip 1: Run screens in batches of 3-5
After step 1 outputs the list, tell the agent:
```
Start with auth screens first (LoginScreen, SignupScreen, OnboardingScreen, etc.)
```
Then proceed flow by flow.

### Tip 2: Validate between batches
After each batch:
```bash
cd p2p-kids-marketplace && yarn typecheck 2>&1 | tail -20
```

### Tip 3: Add context for tricky screens
If a screen has complex logic, add before prompting that specific screen:
```
This screen has [X complex behavior]. Only restyle, do not touch [Y function].
```

### Tip 4: Use this helper command to find remaining legacy screens
Run this to check how many hardcoded colors are left after each batch:
```bash
grep -rn "'#[0-9a-fA-F]\{3,6\}'" src/screens/ --include="*.tsx" | grep -v "\.old\." | grep -v "__tests__" | wc -l
```
Target: 0 (or only intentional brand hex values in comments)

### Tip 5: Check for Ionicons remnants
```bash
grep -rn "expo/vector-icons\|react-native-vector-icons" src/screens/ --include="*.tsx" | grep -v "\.old\." | grep -v "__tests__"
```
Target: 0 matches
