# Design System: Pass It Up
**Kids P2P Marketplace Mobile App**  
**Date**: May 4, 2026  
**Version**: 1.0 (UX Redesign)  
**Design Inspiration**: Samsung Food (clean, modern, warm, accessible)

---

## 1. Overview

This design system defines the visual language and UI components for Pass It Up. All screens, flows, and interactions must follow these guidelines to ensure consistency, accessibility, and a polished user experience.

### Design Principles
1. **Parent-Friendly**: Busy parents need quick, intuitive interactions (60-second listing creation)
2. **Trust & Safety**: Visual cues reinforce platform safety (verified badges, safety checks, secure payments)
3. **Warm & Welcoming**: Kids marketplace should feel friendly, not corporate or sterile
4. **Accessible**: WCAG 2.1 AA compliance (color contrast, touch targets, readable text)
5. **Photo-First**: User-generated item photos are heroes; UI supports, doesn't compete

### Platform Constraints
- **React Native + Expo**: Cross-platform (iOS 14+, Android 10+)
- **No NativeBase**: Custom design system required (NativeBase disabled due to runtime errors)
- **Icon Budget**: $40-60 for custom icon set (IconScout/Noun Project)

---

## 2. Color Palette

### 2.1 Primary Colors

**Primary (Brand)**:
- **Primary 500** (Main): `#4A7C59` — Soft sage green (trust, growth, sustainability)
- **Primary 400** (Light): `#6B9B7A` — For hover states, light backgrounds
- **Primary 600** (Dark): `#3A5F47` — For pressed states, dark mode
- **Primary 100** (Tint): `#E8F3EC` — For subtle backgrounds, cards

**Rationale**: Green evokes sustainability (reuse culture), parent trust, and optimism. Softer than bright greens; warm enough to feel friendly.

### 2.2 Secondary Colors

**Accent (Energy & Action)**:
- **Accent 500** (Main): `#FF8C42` — Warm orange (energy, affordability, excitement)
- **Accent 400** (Light): `#FFB380` — For hover states
- **Accent 600** (Dark): `#E67A2E` — For pressed states
- **Accent 100** (Tint): `#FFF4ED` — For notifications, badges

**Rationale**: Warm orange creates energy without being aggressive. Used for CTAs, badges, success moments.

**Secondary (Supporting)**:
- **Secondary 500**: `#5B8FB9` — Calm blue (information, links, messages)
- **Secondary 400**: `#7BA9CC`
- **Secondary 600**: `#4A7699`
- **Secondary 100**: `#EBF4F9`

### 2.3 Neutral Colors

**Grays (Text & UI Elements)**:
- **Neutral 900**: `#1A1A1A` — Primary text (body copy, headings)
- **Neutral 700**: `#4D4D4D` — Secondary text (captions, labels)
- **Neutral 500**: `#808080` — Tertiary text (placeholders, disabled)
- **Neutral 300**: `#CCCCCC` — Borders, dividers
- **Neutral 100**: `#F5F5F5` — Light backgrounds, cards
- **Neutral 50**: `#FAFAFA` — Page backgrounds
- **White**: `#FFFFFF` — Card backgrounds, modals

### 2.4 Semantic Colors

**Success**:
- **Success 500**: `#4CAF50` — Confirmation messages, completed trades
- **Success 100**: `#E8F5E9` — Success banner backgrounds

**Warning**:
- **Warning 500**: `#FFA726` — Caution messages, pending actions
- **Warning 100**: `#FFF3E0` — Warning banner backgrounds

**Error**:
- **Error 500**: `#E53935` — Error messages, failed actions, CPSC recalls
- **Error 100**: `#FFEBEE` — Error banner backgrounds

**Info**:
- **Info 500**: `#29B6F6` — Informational messages, tips
- **Info 100**: `#E1F5FE` — Info banner backgrounds

### 2.5 Swap Points (SP) Brand Color

**SP Gold**:
- **SP 500**: `#F59E0B` — SP currency indicator (gold coins)
- **SP 100**: `#FEF3C7` — SP balance backgrounds

**Usage**: All SP-related UI elements (wallet balance, earn/spend indicators, SP icons).

### 2.6 Color Usage Guidelines

**Accessibility**:
- **Minimum Contrast**: 4.5:1 for body text (WCAG AA)
- **Large Text Contrast**: 3:1 for 18px+ text
- **Interactive Elements**: 3:1 contrast for buttons, inputs

**Color Roles**:
- **Primary**: Main CTAs, active tabs, primary actions
- **Accent**: Secondary CTAs, badges, notifications, celebration moments
- **Secondary**: Links, informational buttons, message indicators
- **Neutral**: Text hierarchy, borders, backgrounds
- **Semantic**: Status messages, banners, alerts

---

## 3. Typography

### 3.1 Font Family

**Primary Font**: **Inter** (Google Fonts - free, excellent mobile readability)
- **Weights**: 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold)
- **Fallback**: System fonts (San Francisco on iOS, Roboto on Android)

**Rationale**: Inter is optimized for screens, highly legible at small sizes, and pairs well with user-generated content (item photos). Professional but approachable.

**Alternative** (if Inter feels too corporate): **DM Sans** or **Nunito Sans** (friendlier, rounder letterforms)

### 3.2 Type Scale

| Style | Font Size | Line Height | Weight | Letter Spacing | Usage |
|-------|-----------|-------------|--------|----------------|-------|
| **H1** | 32px | 40px | 700 Bold | -0.5px | Page titles (Dashboard, Profile) |
| **H2** | 24px | 32px | 700 Bold | -0.25px | Section headers (Trade Timeline, Subscriptions) |
| **H3** | 20px | 28px | 600 SemiBold | 0px | Card titles, modal headers |
| **H4** | 18px | 24px | 600 SemiBold | 0px | List headers, form section titles |
| **Body Large** | 16px | 24px | 400 Regular | 0px | Main body text, descriptions |
| **Body** | 14px | 20px | 400 Regular | 0px | Default body text, form labels |
| **Body Small** | 12px | 16px | 400 Regular | 0px | Captions, helper text, metadata |
| **Button** | 16px | 24px | 600 SemiBold | 0.5px | Button labels (all caps optional) |
| **Label** | 12px | 16px | 500 Medium | 0.5px | Input labels, overlines (all caps) |
| **Caption** | 10px | 14px | 400 Regular | 0px | Timestamps, fine print |

### 3.3 Text Colors

- **Primary Text**: Neutral 900 (`#1A1A1A`) — Headings, body copy
- **Secondary Text**: Neutral 700 (`#4D4D4D`) — Captions, labels, metadata
- **Tertiary Text**: Neutral 500 (`#808080`) — Placeholders, disabled text
- **Link Text**: Secondary 500 (`#5B8FB9`) — Underlined or standalone links
- **Error Text**: Error 500 (`#E53935`) — Error messages, validation errors

### 3.4 Typography Best Practices

- **Readability**: Minimum 14px for body text on mobile
- **Line Length**: Max 60-70 characters per line for readability
- **Hierarchy**: Use size + weight + color to create clear visual hierarchy
- **Truncation**: Use ellipsis (...) for overflowing text in cards/lists
- **Accessibility**: Never rely on color alone; use weight/size for emphasis

---

## 4. Spacing & Layout

### 4.1 Spacing Scale (8px Grid System)

All spacing uses multiples of 8px for consistency and alignment.

| Token | Value | Usage |
|-------|-------|-------|
| **xs** | 4px | Icon padding, tight gaps |
| **sm** | 8px | Compact spacing, button padding (vertical) |
| **md** | 16px | Default spacing, card padding, button padding (horizontal) |
| **lg** | 24px | Section spacing, modal padding |
| **xl** | 32px | Page margins, large section gaps |
| **2xl** | 40px | Extra large gaps (rare) |

### 4.2 Layout Grid

**Mobile Screen Width**: 375px (iPhone SE baseline), 390px (iPhone 14), 360px (Android standard)

**Margins**:
- **Page Margins**: 16px (md) on left/right
- **Safe Area**: Respect iOS notch, Android gesture navigation

**Card Padding**:
- **Internal Padding**: 16px (md)
- **Vertical Spacing**: 12px between card elements

### 4.3 Component Sizing

**Touch Targets** (WCAG AA):
- **Minimum**: 44px x 44px for all interactive elements (buttons, links, icons)
- **Preferred**: 48px x 48px for primary actions

**Button Heights**:
- **Large**: 56px (primary CTAs)
- **Medium**: 48px (secondary actions)
- **Small**: 40px (tertiary, inline actions)

**Input Heights**:
- **Text Input**: 48px (minimum)
- **Textarea**: 96px minimum height

---

## 5. Iconography

### 5.1 Icon Set

**Source**: Custom icon set from **IconScout** or **Noun Project** ($40-60 budget)

**Style**:
- **Line icons** (not filled) — Clean, modern, consistent with Samsung Food aesthetic
- **Stroke Weight**: 2px (medium weight)
- **Style**: Rounded corners, minimal detail, optimized for 24px display
- **Format**: SVG (scalable, crisp on all screens)

**Icon Library Categories** (estimated 50-70 icons needed):
1. **Navigation**: Home, search, messages, profile, back, close, menu
2. **Actions**: Add, edit, delete, share, favorite, filter, sort
3. **Status**: Checkmark, alert, info, error, verified badge
4. **Objects**: Camera, photo, gift, wallet, star, tag, dollar sign
5. **Social**: Google, Facebook, Apple (use official brand assets - free)
6. **Marketplace**: Shopping cart, package, location pin, clock, calendar

### 5.2 Icon Sizes

| Size | Usage |
|------|-------|
| **16px** | Inline icons (text labels, small buttons) |
| **20px** | Default UI icons (navigation, actions) |
| **24px** | Primary icons (tab bar, headers) |
| **32px** | Large icons (empty states, success moments) |
| **48px+** | Hero icons (onboarding, feature highlights) |

### 5.3 Icon Colors

- **Primary Icons**: Neutral 700 (`#4D4D4D`) — Default state
- **Active Icons**: Primary 500 (`#4A7C59`) — Selected tabs, active filters
- **Disabled Icons**: Neutral 500 (`#808080`) — Disabled actions
- **Accent Icons**: Accent 500 (`#FF8C42`) — Notifications, badges, CTAs
- **Semantic Icons**: Match semantic colors (success, error, warning, info)

### 5.4 Social Login Icons

**Official Brand Assets** (free from brand guidelines):
- **Google**: Google G logo (4-color)
- **Facebook**: Facebook f logo (Facebook Blue #1877F2)
- **Apple**: Apple logo (Black or White, per Apple HIG)

**Button Style**: Icon + text label (e.g., "Continue with Google")

---

## 6. Components

### 6.1 Buttons

#### Primary Button (Main CTAs)
- **Background**: Primary 500 (`#4A7C59`)
- **Text**: White, Button style (16px, 600 SemiBold)
- **Height**: 56px (large) or 48px (medium)
- **Padding**: 16px horizontal, 12px vertical
- **Border Radius**: 12px (rounded, friendly)
- **States**:
  - **Default**: Background Primary 500
  - **Hover/Press**: Background Primary 600 (`#3A5F47`)
  - **Disabled**: Background Neutral 300 (`#CCCCCC`), text Neutral 500

**Usage**: Create listing, Buy now, Confirm trade, Subscribe

#### Secondary Button (Supporting Actions)
- **Background**: White
- **Border**: 2px solid Primary 500
- **Text**: Primary 500, Button style
- **Height**: 48px (medium)
- **Padding**: 16px horizontal, 10px vertical
- **Border Radius**: 12px
- **States**:
  - **Default**: Border Primary 500, text Primary 500
  - **Hover/Press**: Background Primary 100 (`#E8F3EC`)
  - **Disabled**: Border Neutral 300, text Neutral 500

**Usage**: Cancel, Edit, View details

#### Accent Button (High-Energy CTAs)
- **Background**: Accent 500 (`#FF8C42`)
- **Text**: White, Button style
- **Height**: 56px
- **Border Radius**: 12px
- **States**:
  - **Hover/Press**: Background Accent 600 (`#E67A2E`)

**Usage**: Subscribe now, Claim reward, Refer a friend

#### Text Button (Low-Priority Actions)
- **Background**: Transparent
- **Text**: Secondary 500 (`#5B8FB9`), Button style (underline optional)
- **Padding**: 8px horizontal, 8px vertical
- **States**:
  - **Hover/Press**: Text Secondary 600

**Usage**: Skip, Learn more, View all

#### Icon Button
- **Size**: 44px x 44px (minimum touch target)
- **Icon Size**: 24px
- **Background**: Transparent (or Neutral 100 for card actions)
- **Icon Color**: Neutral 700
- **States**:
  - **Hover/Press**: Background Neutral 200

**Usage**: Favorite, Share, Delete, Edit

#### Social Login Buttons
- **Background**: White
- **Border**: 1px solid Neutral 300
- **Height**: 48px
- **Icon**: 20px (left-aligned, 12px margin)
- **Text**: Neutral 900, "Continue with [Provider]"
- **Border Radius**: 12px

**Providers**: Google, Facebook, Apple

### 6.2 Cards

#### Item Card (Discovery Grid)
- **Background**: White
- **Border Radius**: 16px
- **Shadow**: 0px 2px 8px rgba(0, 0, 0, 0.08) (subtle elevation)
- **Padding**: 0 (image bleeds to edges), 12px padding for text content
- **Layout**:
  - Item photo (top, full bleed, 1:1 aspect ratio)
  - Item title (H4, truncate 2 lines)
  - Price (Body Large, 700 Bold, Neutral 900) + SP badge (if applicable)
  - Location + timestamp (Body Small, Neutral 700)
  - Favorite icon (top-right overlay on image)

#### Trade Card (Active Trades List)
- **Background**: White
- **Border Radius**: 16px
- **Shadow**: 0px 2px 8px rgba(0, 0, 0, 0.08)
- **Padding**: 16px
- **Layout**:
  - Item thumbnail (64px x 64px, left)
  - Trade details (right of thumbnail):
    - Trade ID + status badge
    - Buyer/Seller name
    - Item title + price
    - Last activity timestamp
  - Chevron right (trailing icon)

#### Profile Card (User Info)
- **Background**: White
- **Border Radius**: 16px
- **Shadow**: 0px 2px 8px rgba(0, 0, 0, 0.08)
- **Padding**: 16px
- **Layout**:
  - Avatar (48px circle, left)
  - User name (H4) + verified badge (if applicable)
  - User stats (items sold, rating, join date)

#### Banner Card (Info/Warning/Success)
- **Background**: Semantic 100 color (e.g., Warning 100 for grace period banner)
- **Border**: 1px solid Semantic 500
- **Border Radius**: 12px
- **Padding**: 16px
- **Layout**:
  - Icon (24px, Semantic 500, left)
  - Message text (Body, Neutral 900)
  - CTA button (Text Button or Secondary Button)

**Types**: Grace Period, Trial Reminder, CPSC Recall Alert, Success Confirmation

### 6.3 Inputs

#### Text Input
- **Height**: 48px
- **Background**: White
- **Border**: 1px solid Neutral 300
- **Border Radius**: 12px
- **Padding**: 12px horizontal
- **Font**: Body (14px, 400 Regular)
- **States**:
  - **Default**: Border Neutral 300
  - **Focus**: Border Primary 500, 2px width
  - **Error**: Border Error 500, 2px width
  - **Disabled**: Background Neutral 100, text Neutral 500

**Label**: Above input, Label style (12px, 500 Medium, Neutral 700)
**Helper Text**: Below input, Body Small (12px, Neutral 700)
**Error Text**: Below input, Body Small (12px, Error 500)

#### Search Bar
- **Height**: 48px
- **Background**: Neutral 100 (`#F5F5F5`)
- **Border**: None (borderless for clean look)
- **Border Radius**: 24px (pill shape)
- **Icon**: Search icon (20px, Neutral 700, left, 12px padding)
- **Placeholder**: "Search kids' items..." (Neutral 500)

#### Textarea
- **Min Height**: 96px (expandable)
- **Background**: White
- **Border**: 1px solid Neutral 300
- **Border Radius**: 12px
- **Padding**: 12px
- **Font**: Body (14px, 400 Regular)

**Usage**: Item description, review comments

#### Date Picker (iOS/Android Native)
- Trigger button style: Secondary Button
- Uses native platform date picker

#### Slider (Radius, SP Spend Cap)
- **Track Height**: 4px
- **Track Color**: Neutral 300 (inactive), Primary 500 (active)
- **Thumb**: 24px circle, Primary 500, shadow for elevation
- **Labels**: Above slider (current value) + min/max labels

**Usage**: Search radius, SP spend slider in checkout

#### OTP Input (6-Digit Phone Verification)
- **Layout**: 6 individual boxes (horizontal)
- **Box Size**: 48px x 56px
- **Background**: White
- **Border**: 1px solid Neutral 300
- **Border Radius**: 12px
- **Font**: H3 (20px, 600 SemiBold, centered)
- **States**:
  - **Empty**: Border Neutral 300
  - **Focus**: Border Primary 500, 2px width
  - **Filled**: Border Primary 500
  - **Error**: Border Error 500 (all boxes)

### 6.4 Modals

#### Alert Modal
- **Background**: White
- **Border Radius**: 20px (top corners only for bottom sheet, or 16px for centered modal)
- **Padding**: 24px
- **Max Width**: 90% screen width (or full width for bottom sheet)
- **Layout**:
  - Icon (optional, 48px, Accent or Semantic color)
  - Title (H2, centered)
  - Message (Body, Neutral 700, centered)
  - Button(s): Primary + Text Button (vertical stack on mobile)

**Types**: Confirmation, Error, Success

**Backdrop**: Rgba(0, 0, 0, 0.4) — Semi-transparent black overlay

#### Bottom Sheet Modal
- **Background**: White
- **Border Radius**: 20px (top corners only)
- **Handle**: 32px x 4px gray pill (top center, for swipe-down gesture)
- **Padding**: 24px
- **Max Height**: 90% screen height
- **Animation**: Slide up from bottom

**Usage**: Filters, action sheets, phone verification

#### Disclaimer Modal (Legal)
- **Background**: White
- **Border Radius**: 16px
- **Padding**: 24px
- **Layout**:
  - Title (H2)
  - Scrollable content (Body, max height 60% screen)
  - Checkbox: "I agree to terms" (Label style)
  - Primary Button: "Continue"

### 6.5 Navigation

#### Bottom Tab Bar
- **Height**: 64px + safe area inset (iOS bottom spacing)
- **Background**: White
- **Top Border**: 1px solid Neutral 200
- **Shadow**: 0px -2px 8px rgba(0, 0, 0, 0.04) (subtle top shadow)
- **Tabs**: 4 tabs (Dashboard, Discover, Messages, Profile) OR 5 tabs with center "+" button (TBD by Figma team)
- **Icon Size**: 24px
- **Label**: Body Small (10px), below icon
- **States**:
  - **Active**: Icon + label Primary 500
  - **Inactive**: Icon + label Neutral 500

**5th Tab Option** (if Figma team adds):
- **Center Tab**: 56px circle FAB (Floating Action Button), Accent 500 background, white "+" icon
- **Position**: Raised above tab bar by 12px
- **Action**: Quick create listing

#### Header (Stack Navigator)
- **Height**: 56px + status bar
- **Background**: White
- **Bottom Border**: 1px solid Neutral 200
- **Title**: H3 (20px, 600 SemiBold, centered or left-aligned)
- **Left Action**: Back button (chevron left icon, 44px x 44px touch target)
- **Right Actions**: Icon buttons (e.g., share, edit, delete)

**Transparent Header** (for screens with image heroes):
- **Background**: Transparent
- **Back Button**: White icon with dark shadow for visibility

### 6.6 Lists & Grids

#### Item Grid (Discovery)
- **Columns**: 2 (mobile)
- **Gap**: 12px (between cards)
- **Card**: Item Card (see 6.2)
- **Layout**: Equal width columns, dynamic height (based on image + text)

#### Conversation List
- **Layout**: Single column list
- **Row Height**: Dynamic (min 72px)
- **Row Layout**:
  - Avatar (48px circle, left)
  - Message preview (right of avatar):
    - Sender name (Body, 600 SemiBold)
    - Last message (Body Small, Neutral 700, truncate 1 line)
    - Timestamp (Caption, Neutral 500, top-right)
  - Unread badge (Accent 500 dot, 8px, top-right of avatar)
- **Divider**: 1px solid Neutral 200 (between rows)

#### Transaction History List
- **Layout**: Single column list with date section headers
- **Section Header**: Label style (12px, 500 Medium, all caps), Neutral 700, 8px padding top
- **Row Layout**:
  - Icon (24px, left, Semantic color based on transaction type)
  - Transaction details (right of icon):
    - Transaction type (Body, 600 SemiBold)
    - Amount (Body, 700 Bold, Success or Error color)
    - Date (Body Small, Neutral 700)

### 6.7 Badges & Pills

#### Status Badge
- **Height**: 24px
- **Padding**: 8px horizontal, 4px vertical
- **Border Radius**: 12px (pill shape)
- **Font**: Label style (12px, 500 Medium)
- **Colors**:
  - **Active/Verified**: Success 500 background, white text
  - **Pending**: Warning 500 background, white text
  - **Cancelled**: Neutral 500 background, white text
  - **Recalled**: Error 500 background, white text

**Usage**: Trade status, verification status, CPSC recall alert

#### SP Badge (Swap Points Indicator)
- **Background**: SP 100 (`#FEF3C7`)
- **Border**: 1px solid SP 500 (`#F59E0B`)
- **Border Radius**: 12px
- **Padding**: 6px horizontal, 4px vertical
- **Icon**: SP coin icon (16px, SP 500, left)
- **Text**: "Earn 250 SP" or "Use up to 500 SP" (Label style, SP 500)

**Usage**: Item cards (show earn potential), checkout (show spend capability)

#### User Badge (Gamification)
- **Size**: 48px x 48px (profile showcase), 24px x 24px (inline)
- **Shape**: Custom badge shape (imported from assets)
- **Colors**: Varies by badge tier (Bronze, Silver, Gold, Platinum)

**Usage**: Profile screen, leaderboard, achievements

### 6.8 Empty States

#### Illustration + Message
- **Layout**:
  - Illustration (120px x 120px, centered)
  - Title (H3, centered, Neutral 900)
  - Message (Body, centered, Neutral 700, max 2 lines)
  - CTA Button (Primary or Secondary, centered below message)
- **Illustration Source**: unDraw (free) or custom ($20-40 from design marketplaces)

**Usage**: No search results, no messages, no listings, no favorites

#### Icon + Message (Compact)
- **Layout**:
  - Icon (48px, Neutral 500, centered)
  - Message (Body, centered, Neutral 700)

**Usage**: Empty sections within screens (e.g., no active trades in dashboard widget)

### 6.9 Loading States

#### Spinner
- **Size**: 32px (small), 48px (medium), 64px (large)
- **Color**: Primary 500 (for branded loading), Neutral 500 (for subtle loading)
- **Style**: Circular spinner (iOS native ActivityIndicator style)

**Usage**: Full-screen loading, button loading (small spinner), lazy load pagination

#### Skeleton Loader
- **Background**: Animated gradient (Neutral 100 → Neutral 200 → Neutral 100)
- **Shape**: Matches content shape (text = rounded rectangle, image = 1:1 square, etc.)
- **Animation**: Shimmer effect (1.5s loop)

**Usage**: Item grid loading, profile loading, trade list loading

### 6.10 Toast Notifications

#### Snackbar (Bottom Toast)
- **Background**: Neutral 900 (dark, high contrast)
- **Text**: White, Body (14px)
- **Height**: 48px
- **Border Radius**: 8px
- **Padding**: 16px
- **Position**: Bottom of screen, 16px margin, above tab bar
- **Duration**: 3s (auto-dismiss)
- **Action** (optional): Text button (white text, right-aligned)

**Types**: Success (checkmark icon), Error (alert icon), Info (info icon)

**Usage**: "Item added to favorites", "Listing created", "Error uploading photo"

---

## 7. Imagery & Photography

### 7.1 User-Generated Content (Item Photos)

**Requirements**:
- **Aspect Ratio**: 1:1 (square) — Forced crop on upload for grid consistency
- **Min Resolution**: 600px x 600px
- **Max File Size**: 5MB
- **Format**: JPEG, PNG
- **Safety**: AI moderation (FLOW-16) + CPSC recall matching

**Display**:
- **Item Card**: Full bleed, 1:1 ratio, 4px border radius (top corners only)
- **Item Detail**: Hero image, full width, 1:1 ratio, swipe gallery for multiple photos
- **Thumbnails**: 64px x 64px (trade cards), 48px x 48px (transaction history)

### 7.2 Avatars

**User Avatars**:
- **Size**: 48px (default), 32px (small), 64px (large profile header)
- **Shape**: Circle
- **Placeholder**: Initials on Primary 100 background, Primary 500 text (if no photo)

**Upload Requirements**:
- **Aspect Ratio**: 1:1 (square crop)
- **Min Resolution**: 200px x 200px
- **Max File Size**: 2MB

### 7.3 Onboarding Illustrations

**Style**: Friendly, minimal, 2-3 color illustrations (Primary, Accent, Neutral)
**Source**: unDraw (free) or custom ($20-40)
**Size**: 240px x 180px (landscape orientation)

**Screens**: Welcome carousel, feature highlights, empty states

### 7.4 Success/Celebration Graphics

**Style**: Confetti, checkmarks, coins (for SP earnings), trophy (for badges)
**Source**: LottieFiles (free animations) or static graphics ($10-20)
**Size**: 120px x 120px (centered)

**Screens**: Trade success, subscription success, badge unlocked

---

## 8. Elevation & Shadows

### 8.1 Shadow Scale

| Level | Usage | Shadow CSS |
|-------|-------|------------|
| **Level 0** | Flat (no shadow) | `none` |
| **Level 1** | Cards, inputs | `0px 2px 8px rgba(0, 0, 0, 0.08)` |
| **Level 2** | Modals, bottom sheets | `0px 4px 16px rgba(0, 0, 0, 0.12)` |
| **Level 3** | FAB (center tab), overlays | `0px 8px 24px rgba(0, 0, 0, 0.16)` |

**Note**: Avoid excessive shadows (feels heavy); use sparingly for elevation hierarchy.

### 8.2 Border Radius

- **Small**: 8px (badges, pills, tags)
- **Medium**: 12px (buttons, inputs, small cards)
- **Large**: 16px (main cards, item cards)
- **Extra Large**: 20px (modals, bottom sheets)
- **Circle**: 50% (avatars, icon buttons, FAB)

---

## 9. Animation & Transitions

### 9.1 Timing

- **Fast**: 150ms (hover, press states)
- **Medium**: 300ms (screen transitions, modals)
- **Slow**: 500ms (celebration animations, success moments)

### 9.2 Easing

- **Standard**: `cubic-bezier(0.4, 0.0, 0.2, 1)` — Material Design standard easing
- **Decelerate**: `cubic-bezier(0.0, 0.0, 0.2, 1)` — Enter animations (modals, screens)
- **Accelerate**: `cubic-bezier(0.4, 0.0, 1, 1)` — Exit animations

### 9.3 Animations

**Button Press**:
- Scale down to 0.96 (150ms)
- Background color change (150ms)

**Modal Enter/Exit**:
- Slide up from bottom (300ms, decelerate easing)
- Fade in backdrop (200ms)
- Slide down on dismiss (250ms, accelerate easing)

**Screen Transitions**:
- Slide in from right (300ms) — Push navigation
- Fade in (300ms) — Tab navigation

**Loading Skeleton**:
- Shimmer loop (1.5s, infinite)

**Success Moments**:
- Scale in + bounce (500ms) — Checkmark, celebration graphics
- Confetti animation (2s, LottieFiles)

---

## 10. Accessibility

### 10.1 Color Contrast

**WCAG 2.1 Level AA Compliance**:
- **Body Text**: 4.5:1 minimum contrast ratio
- **Large Text** (18px+): 3:1 minimum contrast ratio
- **Interactive Elements**: 3:1 minimum contrast ratio

**Testing**: Use Contrast Checker (WebAIM) to validate all text/background combinations.

### 10.2 Touch Targets

- **Minimum**: 44px x 44px (Apple HIG, WCAG)
- **Preferred**: 48px x 48px (Material Design)
- **Spacing**: 8px minimum gap between adjacent touch targets

### 10.3 Text Legibility

- **Minimum Font Size**: 14px for body text
- **Line Height**: 1.4-1.6 for body text (readable line spacing)
- **Line Length**: Max 70 characters per line (avoid wide text blocks)

### 10.4 Screen Reader Support

- **Semantic HTML/React Native**: Use proper component types (Button, TextInput, etc.)
- **Labels**: All interactive elements need accessible labels
- **Focus Order**: Logical tab/focus order (top to bottom, left to right)
- **Alternative Text**: All images need alt text (item titles, user names, etc.)

### 10.5 Reduced Motion

- **Respect User Preference**: Check system `prefers-reduced-motion` setting
- **Fallback**: Disable animations, use instant transitions if user prefers reduced motion

---

## 11. Design Tokens (Developer Handoff)

### 11.1 Color Tokens

```javascript
// colors.ts
export const colors = {
  primary: {
    500: '#4A7C59',
    400: '#6B9B7A',
    600: '#3A5F47',
    100: '#E8F3EC',
  },
  accent: {
    500: '#FF8C42',
    400: '#FFB380',
    600: '#E67A2E',
    100: '#FFF4ED',
  },
  secondary: {
    500: '#5B8FB9',
    400: '#7BA9CC',
    600: '#4A7699',
    100: '#EBF4F9',
  },
  neutral: {
    900: '#1A1A1A',
    700: '#4D4D4D',
    500: '#808080',
    300: '#CCCCCC',
    100: '#F5F5F5',
    50: '#FAFAFA',
    white: '#FFFFFF',
  },
  success: { 500: '#4CAF50', 100: '#E8F5E9' },
  warning: { 500: '#FFA726', 100: '#FFF3E0' },
  error: { 500: '#E53935', 100: '#FFEBEE' },
  info: { 500: '#29B6F6', 100: '#E1F5FE' },
  sp: { 500: '#F59E0B', 100: '#FEF3C7' },
};
```

### 11.2 Typography Tokens

```javascript
// typography.ts
export const typography = {
  fontFamily: {
    primary: 'Inter',
    fallback: 'System', // San Francisco (iOS), Roboto (Android)
  },
  fontSize: {
    h1: 32,
    h2: 24,
    h3: 20,
    h4: 18,
    bodyLarge: 16,
    body: 14,
    bodySmall: 12,
    button: 16,
    label: 12,
    caption: 10,
  },
  lineHeight: {
    h1: 40,
    h2: 32,
    h3: 28,
    h4: 24,
    bodyLarge: 24,
    body: 20,
    bodySmall: 16,
    button: 24,
    label: 16,
    caption: 14,
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
};
```

### 11.3 Spacing Tokens

```javascript
// spacing.ts
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
};
```

### 11.4 Border Radius Tokens

```javascript
// borderRadius.ts
export const borderRadius = {
  small: 8,
  medium: 12,
  large: 16,
  xlarge: 20,
  circle: '50%',
};
```

---

## 12. Implementation Notes

### 12.1 Figma Setup

**File Structure**:
- **Page 1**: Design System (this document as Figma pages)
  - Colors (swatches)
  - Typography (text styles)
  - Components (button variants, cards, inputs, etc.)
- **Page 2**: Screens (organized by flow)
- **Page 3**: Icons (imported icon set)

**Component Library**:
- Create Figma components for all reusable elements (buttons, cards, inputs)
- Use variants for button states (default, hover, disabled)
- Use auto-layout for responsive components

### 12.2 Developer Handoff

**Export Format**:
- **Design Tokens**: JSON export from Figma (colors, typography, spacing)
- **Icons**: SVG export (24px artboard)
- **Screens**: Figma links + annotations for interactions

**Figma Plugins** (optional):
- **Design Tokens**: Export tokens for React Native
- **Stark**: Accessibility contrast checker
- **Iconify**: Icon library integration

### 12.3 Testing Checklist

Before finalizing designs:
- [ ] All text passes WCAG AA contrast ratios
- [ ] All touch targets are 44px x 44px minimum
- [ ] All interactive states defined (default, hover, press, disabled)
- [ ] All empty states designed
- [ ] All error states designed
- [ ] All loading states designed
- [ ] Responsive layouts tested at 375px, 390px, 360px widths
- [ ] Dark mode considered (optional, Phase 2)

---

## 13. Design System Maintenance

### 13.1 Version Control

- **Version**: 1.0 (UX Redesign launch)
- **Updates**: Document all changes to colors, typography, components
- **Changelog**: Maintain changelog in Figma file

### 13.2 Governance

- **Single Source of Truth**: This markdown document + Figma component library
- **Approval**: All new components require design system approval before implementation
- **Testing**: All component changes require visual regression testing (screenshot comparison)

### 13.3 Expansion

**Future Additions** (Phase 2+):
- Dark mode palette
- Tablet/iPad layouts (landscape)
- Accessibility enhancements (voice control, font scaling)
- Advanced animations (Lottie integration)

---

## Appendix A: Component Checklist

**Completed Components** (ready for Figma):
- [x] Buttons (Primary, Secondary, Accent, Text, Icon, Social Login)
- [x] Cards (Item, Trade, Profile, Banner)
- [x] Inputs (Text, Search, Textarea, Date Picker, Slider, OTP)
- [x] Modals (Alert, Bottom Sheet, Disclaimer)
- [x] Navigation (Bottom Tabs, Header)
- [x] Lists (Item Grid, Conversation List, Transaction History)
- [x] Badges (Status, SP, User)
- [x] Empty States (Illustration, Icon)
- [x] Loading States (Spinner, Skeleton)
- [x] Toast Notifications (Snackbar)

**Pending Components** (define as needed):
- [ ] Progress bars (for multi-step flows)
- [ ] Radio buttons, checkboxes (for forms)
- [ ] Toggle switches (for settings)
- [ ] Segmented controls (for tab switching within screens)
- [ ] Stepper (for quantity selection in cart)
- [ ] Accordion (for FAQs, help content)

---

## Appendix B: Samsung Food Design Reference

**Key Takeaways from Samsung Food Aesthetic**:
1. **Warm, Approachable Colors**: Soft greens, warm oranges (not harsh primary colors)
2. **Generous White Space**: Cards have breathing room, not cramped
3. **Clear Hierarchy**: Bold headings, readable body text, subtle captions
4. **Rounded Corners**: 12-16px border radius on cards/buttons (friendly, modern)
5. **Subtle Shadows**: Elevation used sparingly (Level 1 for most cards)
6. **Photo-First**: Large, high-quality images (user content is hero)
7. **Clean Icons**: Line icons (not filled), consistent stroke weight
8. **Accessible Touch Targets**: 48px+ buttons, generous padding

**Adaptations for Pass It Up**:
- Replace Samsung Food's red accent with warm orange (more kid-friendly)
- Add SP gold color for gamification (not present in Samsung Food)
- Increase border radius slightly for friendlier feel (kids marketplace)
- Maintain clean, minimal aesthetic (avoid clutter for busy parents)

---

**End of Design System Document**
