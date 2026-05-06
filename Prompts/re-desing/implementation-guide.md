# Implementation Guide: Pass It Up
**Code Implementation Plan**  
*Last Updated: May 5, 2026*

---

## 📋 DOCUMENT OVERVIEW

This guide provides the complete roadmap for implementing the Pass It Up app with the new design system.

**Prerequisites**:
- ✅ Document 1: app-overview.md (App concept & business model)
- ✅ Document 2: design-system-passitup.md (Whisk-inspired design system)
- ✅ Document 3: screen-flow-mapping.md (68 screens mapped to 27 flows)
- ✅ Existing React Native codebase (p2p-kids-marketplace/)

**Target Deliverables**:
- Production-ready React Native implementation with new design system
- Custom icon set (Phosphor Icons - $49)
- Onboarding illustration assets (Storyset)
- Updated codebase with duplicate cleanup

---

## � DESIGN SYSTEM PREPARATION

### Asset Acquisition

#### **Custom Icon Set** ($49)

**Decision**: Purchase **Phosphor Icons** pack

**Specifications**:
- **Quantity**: 6,000+ icons (more than enough to replace all Ionicons)
- **Style**: Line icons, 2px stroke weight, rounded caps
- **Sizes**: 20px, 24px, 32px (default 24px)
- **Format**: SVG (optimized, single color)
- **Cost**: $49 one-time purchase
- **Benefits**: Immediate availability, React Native support, regular updates

**Icon Categories Covered**:
- Navigation: home, search, messages, profile, back, forward, menu
- Actions: add, edit, delete, share, bookmark, filter, sort
- Commerce: cart, price-tag, wallet, coin, receipt
- Communication: send, attach, emoji, call, video
- Status: checkmark, close, alert, info, warning, success
- Media: camera, image, play, pause, upload
- Social: heart, star, thumbs-up, flag, shield
- Misc: location, calendar, clock, settings, help

**Implementation**:
```bash
# Install Phosphor Icons for React Native
npm install phosphor-react-native

# Usage in components
import { House, MagnifyingGlass, ChatCircle } from 'phosphor-react-native';

<House size={24} color="#5DBB8E" weight="regular" />
```

**Organization**:
- Use directly from package (no need to create custom components)
- Standardize weight: `regular` (default), `bold` (emphasis), `fill` (selected state)
- Color via props: `#5DBB8E` (primary green), `#1A1A1A` (default), `#6B6B6B` (muted)

#### **Onboarding Illustrations**

**Decision**: Use **Storyset** (free with customization)

**Specifications**:
- **Quantity**: 3-4 illustrations for Feature Highlights carousel
- **Themes**:
  1. Swap Points earning (coins, rewards, celebration)
  2. Safe local trading (handshake, location, shield)
  3. Kids items marketplace (toys, clothes, books, happy families)
  4. Sustainable reuse (recycling, earth, growth)
- **Size**: 400x300px @ 2x resolution (800x600px)
- **Format**: PNG with transparency
- **Cost**: Free (commercial license included)

**Customization Steps**:
1. Visit [Storyset.com](https://storyset.com)
2. Search for relevant illustration sets (e.g., "shopping", "family", "recycling")
3. Customize colors to match brand palette:
   - Primary: #5DBB8E (Whisk green)
   - Accent: #F59E0B (SP gold)
   - Neutral: #1A1A1A, #6B6B6B
4. Download as PNG @ 2x resolution
5. Optimize with ImageOptim or TinyPNG

**Implementation**:
```bash
# Store in assets folder
src/assets/illustrations/
├── onboarding-sp-earning.png
├── onboarding-safe-trading.png
├── onboarding-marketplace.png
└── onboarding-sustainable.png

# Usage in screens
<Image
  source={require('@/assets/illustrations/onboarding-sp-earning.png')}
  style={{ width: 280, height: 210 }}
  resizeMode="contain"
/>
```

#### **Other Assets**

**Empty State Illustrations**:
- Use Phosphor Icons + typography (no additional cost)
- Examples: `Package` icon for empty cart, `ChatCircleSlash` for no messages
- Style: 64px icon in #E0E0E0, centered with 16px body text below

**App Icon & Splash Screen**:
- Design after core screens implemented
- Requires brand mark/logo (not in current scope)
- Budget: TBD

---

## 🤖 AI AGENT ASSET REFERENCE

This section provides a curated reference for AI agents implementing screens. Use this to select appropriate icons and illustrations for each UI element.

### Phosphor Icons Quick Reference

**Installation**: `npm install phosphor-react-native`

**Import Pattern**:
```typescript
import { IconName } from 'phosphor-react-native';

// Usage
<IconName size={24} color="#5DBB8E" weight="regular" />
```

**Weight Options**: `regular` (default), `bold` (emphasis), `fill` (selected/active state)

**Color Conventions**:
- Primary action: `#5DBB8E` (green)
- Default/neutral: `#1A1A1A` (dark)
- Muted/secondary: `#6B6B6B` (gray)
- Disabled: `#E0E0E0` (light gray)
- SP/rewards: `#F59E0B` (gold)

#### **Navigation Icons** (Tab Bar, Headers, Back Buttons)

| Icon Name | Usage | Size | Color |
|-----------|-------|------|-------|
| `House` | Home/Dashboard tab | 24px | Primary green (active), gray (inactive) |
| `MagnifyingGlass` | Search/Discover tab | 24px | Primary green (active), gray (inactive) |
| `ChatCircle` | Messages tab | 24px | Primary green (active), gray (inactive) |
| `User` | Profile tab | 24px | Primary green (active), gray (inactive) |
| `ShoppingCart` | Cart tab (optional 5th tab) | 24px | Primary green (active), gray (inactive) |
| `CaretLeft` | Back button (iOS style) | 20px | Dark |
| `ArrowLeft` | Back button (Android style) | 24px | Dark |
| `X` | Close modal/screen | 24px | Dark |
| `List` | Menu/hamburger | 24px | Dark |
| `DotsThree` | More options (vertical) | 24px | Dark |
| `DotsThreeOutline` | More options (horizontal) | 24px | Dark |

#### **Action Icons** (Buttons, CTAs, User Actions)

| Icon Name | Usage | Size | Color |
|-----------|-------|------|-------|
| `Plus` | Add to cart, create listing, add item | 20px | White (on colored bg), primary (on white) |
| `PlusCircle` | Add action (standalone) | 32px | Primary green |
| `PencilSimple` | Edit listing, edit profile | 20px | Dark |
| `Trash` | Delete item, remove from cart | 20px | Error red (#E85D75) |
| `Check` | Confirm, complete, approve | 20px | Success green |
| `CheckCircle` | Success state | 32px | Success green |
| `Share` | Share listing, referral code | 20px | Dark |
| `ShareNetwork` | Social sharing | 20px | Dark |
| `BookmarkSimple` | Save for later (outline) | 20px | Dark |
| `BookmarkSimple` (fill) | Saved item (filled) | 20px | Primary green |
| `Heart` | Favorite (outline) | 20px | Dark |
| `Heart` (fill) | Favorited (filled) | 20px | Error red |
| `FunnelSimple` | Filter results | 20px | Dark |
| `SortAscending` | Sort options | 20px | Dark |
| `SlidersHorizontal` | Settings, preferences | 20px | Dark |
| `Camera` | Take photo, upload image | 24px | Primary green |
| `Image` | Select from gallery | 24px | Dark |
| `Upload` | Upload file/photo | 20px | Primary green |
| `Download` | Download receipt, export | 20px | Dark |
| `ArrowClockwise` | Refresh, retry | 20px | Dark |
| `SignOut` | Logout | 20px | Dark |

#### **Commerce Icons** (Listings, Transactions, Money)

| Icon Name | Usage | Size | Color |
|-----------|-------|------|-------|
| `ShoppingCart` | Add to cart button | 20px | White (on green button) |
| `ShoppingCartSimple` | Cart icon (header) | 24px | Dark |
| `Tag` | Price tag, pricing | 20px | Dark |
| `CurrencyDollar` | Price, payment | 20px | Dark |
| `Wallet` | SP wallet, balance | 24px | SP gold (#F59E0B) |
| `Coins` | Swap Points, SP earning | 24px | SP gold (#F59E0B) |
| `CreditCard` | Payment method | 20px | Dark |
| `Receipt` | Order summary, transaction | 20px | Dark |
| `Package` | Shipping, delivery, item | 24px | Dark |
| `Storefront` | My listings, seller profile | 24px | Primary green |
| `Barcode` | Product code, SKU | 20px | Dark |
| `QrCode` | QR code scanner | 24px | Dark |
| `Percent` | Discount, fee | 20px | SP gold |
| `TrendUp` | Revenue growth, analytics | 20px | Success green |
| `ChartLine` | Analytics, insights | 24px | Dark |

#### **Communication Icons** (Messages, Notifications, Social)

| Icon Name | Usage | Size | Color |
|-----------|-------|------|-------|
| `ChatCircle` | Messages, conversation | 24px | Primary green |
| `ChatCircleDots` | Chat bubble (typing indicator) | 20px | Gray |
| `PaperPlaneRight` | Send message | 20px | Primary green |
| `Bell` | Notifications | 24px | Dark |
| `Bell` (fill) | Unread notifications | 24px | Warning (#FFA726) |
| `Phone` | Call, phone verification | 20px | Dark |
| `Envelope` | Email | 20px | Dark |
| `EnvelopeSimple` | Mail (simple) | 20px | Dark |
| `At` | Email, mention | 16px | Dark |
| `PaperClip` | Attachment | 20px | Dark |
| `Smiley` | Emoji picker | 20px | Dark |
| `VideoCamera` | Video call | 20px | Dark |
| `Microphone` | Voice message | 20px | Dark |
| `ThumbsUp` | Like, approve | 20px | Primary green |
| `ThumbsDown` | Dislike, reject | 20px | Error red |
| `Flag` | Report, flag content | 20px | Error red |
| `Warning` | Warning, alert | 20px | Warning (#FFA726) |
| `WarningCircle` | Caution, important | 24px | Warning |
| `Info` | Information, help tooltip | 20px | Info blue (#5B8FB9) |

#### **Status & Feedback Icons** (States, Progress, Alerts)

| Icon Name | Usage | Size | Color |
|-----------|-------|------|-------|
| `CheckCircle` | Success, completed | 32px | Success green (#5DBB8E) |
| `XCircle` | Error, failed | 32px | Error red (#E85D75) |
| `WarningCircle` | Warning, caution | 32px | Warning (#FFA726) |
| `InfoCircle` | Information, tip | 32px | Info blue (#5B8FB9) |
| `Clock` | Pending, waiting | 24px | Gray |
| `ClockCountdown` | Timer, expiring soon | 24px | Warning |
| `Hourglass` | Processing, loading | 24px | Gray |
| `Spinner` | Loading indicator | 24px | Primary green |
| `CircleNotch` | Loading spinner (animated) | 24px | Primary green |
| `CheckSquare` | Checkbox (checked) | 20px | Primary green |
| `Square` | Checkbox (unchecked) | 20px | Gray |
| `RadioButton` | Radio selected | 20px | Primary green |
| `Circle` | Radio unselected | 20px | Gray |
| `Eye` | Show password, view item | 20px | Dark |
| `EyeSlash` | Hide password, hidden | 20px | Dark |
| `Lock` | Secure, locked, password | 20px | Dark |
| `LockOpen` | Unlocked, accessible | 20px | Primary green |
| `ShieldCheck` | Verified, safe | 24px | Success green |
| `ShieldWarning` | Safety concern, recall | 24px | Error red |
| `Star` | Rating (outline) | 20px | Gray |
| `Star` (fill) | Rating (filled) | 20px | SP gold (#F59E0B) |

#### **User & Profile Icons** (Account, Identity, Roles)

| Icon Name | Usage | Size | Color |
|-----------|-------|------|-------|
| `User` | Profile, account | 24px | Dark |
| `UserCircle` | Avatar placeholder | 64px | Gray (#E0E0E0) |
| `Users` | Community, users | 24px | Dark |
| `UserPlus` | Add friend, referral | 20px | Primary green |
| `Crown` | Premium subscriber, Pro tier | 20px | SP gold (#F59E0B) |
| `CrownSimple` | Basic subscriber | 20px | Gray |
| `Certificate` | Badge, achievement | 24px | SP gold |
| `Medal` | Top seller, featured | 24px | SP gold |
| `IdentificationCard` | ID verification | 24px | Dark |
| `Baby` | Kids category, age gate | 24px | Primary green |
| `GenderMale` | Boy items category | 20px | Info blue |
| `GenderFemale` | Girl items category | 20px | Error red |
| `GenderNeuter` | Gender-neutral items | 20px | Gray |

#### **Location & Maps Icons** (Address, Node, ZIP)

| Icon Name | Usage | Size | Color |
|-----------|-------|------|-------|
| `MapPin` | Location, address | 20px | Primary green |
| `MapPinLine` | Node selection | 24px | Primary green |
| `MapTrifold` | Map view, area | 24px | Dark |
| `Crosshair` | Current location, GPS | 20px | Primary green |
| `NavigationArrow` | Directions, navigate | 20px | Dark |
| `Compass` | Explore, discover nearby | 24px | Primary green |
| `House` | Home address | 20px | Dark |
| `Buildings` | Node/neighborhood | 24px | Primary green |
| `GlobeHemisphereWest` | Region, area | 24px | Dark |

#### **Category & Item Icons** (Product Types, Classifications)

| Icon Name | Usage | Size | Color |
|-----------|-------|------|-------|
| `Tshirt` | Clothing category | 32px | Primary green |
| `Sneaker` | Shoes category | 32px | Primary green |
| `Backpack` | Bags, accessories | 32px | Primary green |
| `GameController` | Toys, games | 32px | Primary green |
| `BookOpen` | Books, education | 32px | Primary green |
| `Baby` | Baby items | 32px | Primary green |
| `Bicycle` | Sports, outdoor | 32px | Primary green |
| `MusicNote` | Music, instruments | 32px | Primary green |
| `PaintBrush` | Arts & crafts | 32px | Primary green |
| `Laptop` | Electronics | 32px | Primary green |
| `Bed` | Furniture, home | 32px | Primary green |
| `FirstAid` | Health, safety | 32px | Primary green |
| `Gift` | Gift items, special | 32px | SP gold |
| `Sparkle` | Featured, special offer | 20px | SP gold |
| `Lightning` | Flash sale, urgent | 20px | Warning |

#### **Settings & System Icons** (Preferences, App Controls)

| Icon Name | Usage | Size | Color |
|-----------|-------|------|-------|
| `Gear` | Settings, preferences | 24px | Dark |
| `Wrench` | Tools, admin | 24px | Dark |
| `ToggleLeft` | Toggle OFF | 24px | Gray |
| `ToggleRight` | Toggle ON | 24px | Primary green |
| `Moon` | Dark mode | 20px | Dark |
| `Sun` | Light mode | 20px | SP gold |
| `Palette` | Theme, appearance | 20px | Dark |
| `TextAa` | Font size, accessibility | 20px | Dark |
| `SpeakerHigh` | Sound ON | 20px | Dark |
| `SpeakerSlash` | Sound OFF/muted | 20px | Gray |
| `Translate` | Language, translation | 20px | Dark |
| `Question` | Help, FAQ | 24px | Info blue |
| `QuestionMark` | Unknown, unclear | 20px | Gray |
| `Lifebuoy` | Support, help center | 24px | Primary green |
| `ChatsCircle` | Customer support chat | 24px | Primary green |
| `Bug` | Report bug | 20px | Error red |
| `FileText` | Terms, policy, document | 20px | Dark |
| `Newspaper` | News, updates | 20px | Dark |
| `MegaPhone` | Announcements | 24px | Primary green |

#### **Empty State Icons** (No Content, Errors)

| Icon Name | Usage | Size | Color |
|-----------|-------|------|-------|
| `Package` | Empty cart, no orders | 64px | Light gray (#E0E0E0) |
| `Storefront` | No listings yet | 64px | Light gray |
| `ChatCircleSlash` | No messages | 64px | Light gray |
| `Bell` (outline) | No notifications | 64px | Light gray |
| `MagnifyingGlass` | No search results | 64px | Light gray |
| `FolderOpen` | Empty folder | 64px | Light gray |
| `Tray` | Empty state (generic) | 64px | Light gray |
| `CloudSlash` | Offline, no connection | 64px | Light gray |
| `WifiSlash` | No internet | 64px | Light gray |
| `WarningOctagon` | Error state | 64px | Error red |
| `ProhibitInset` | Restricted, blocked | 64px | Error red |

#### **Time & Calendar Icons** (Dates, Scheduling)

| Icon Name | Usage | Size | Color |
|-----------|-------|------|-------|
| `Calendar` | Date picker, schedule | 20px | Dark |
| `CalendarBlank` | Calendar view | 24px | Dark |
| `CalendarCheck` | Appointment confirmed | 20px | Success green |
| `Clock` | Time, timestamp | 20px | Dark |
| `Timer` | Countdown, expires | 20px | Warning |
| `Alarm` | Reminder, alert | 20px | Warning |
| `Hourglass` | Duration, waiting | 20px | Gray |

**Usage Example in Screen Implementation**:
```typescript
// In LoginScreen.tsx
import { EnvelopeSimple, Lock, Eye, EyeSlash } from 'phosphor-react-native';

// Email input icon
<EnvelopeSimple size={20} color="#6B6B6B" weight="regular" />

// Password input icon
<Lock size={20} color="#6B6B6B" weight="regular" />

// Toggle password visibility
{showPassword ? (
  <EyeSlash size={20} color="#1A1A1A" weight="regular" />
) : (
  <Eye size={20} color="#1A1A1A" weight="regular" />
)}
```

---

### Storyset Illustrations Catalog

**Location**: `src/assets/illustrations/`

**Format**: PNG with transparency, 800x600px (2x resolution)

**Color Customization**: All illustrations use brand colors (green #5DBB8E, gold #F59E0B)

#### **Illustration Inventory**

| Filename | Description | Usage Context | Dimensions |
|----------|-------------|---------------|------------|
| `onboarding-sp-earning.png` | Cartoon of coins, piggy bank, and confetti celebrating rewards | FLOW-02: Feature Highlights screen, slide 1 - explains SP earning | 280x210pt |
| `onboarding-safe-trading.png` | Friendly handshake between two people with shield and location pin | FLOW-02: Feature Highlights screen, slide 2 - explains safe local trades | 280x210pt |
| `onboarding-marketplace.png` | Diverse families browsing items (toys, clothes, books) with happy children | FLOW-02: Feature Highlights screen, slide 3 - explains kids marketplace | 280x210pt |
| `onboarding-sustainable.png` | Earth with recycling arrows, growing plants, and reuse symbols | FLOW-02: Feature Highlights screen, slide 4 - explains sustainability | 280x210pt |

#### **Empty State Illustrations** (Icon-Based, No Custom Assets)

For empty states, use **Phosphor Icons at 64px** in light gray (#E0E0E0) with 16px body text below:

| Screen | Icon | Text |
|--------|------|------|
| Empty Cart | `Package` | "Your cart is empty\nStart adding items!" |
| No Messages | `ChatCircleSlash` | "No messages yet\nStart a conversation!" |
| No Notifications | `Bell` (outline) | "You're all caught up!\nNo new notifications" |
| No Listings | `Storefront` | "No listings yet\nCreate your first item!" |
| No Search Results | `MagnifyingGlass` | "No items found\nTry different keywords" |
| No Transaction History | `Receipt` | "No transactions yet\nStart trading to see history" |
| Offline State | `WifiSlash` | "No internet connection\nCheck your network" |

**Implementation Example**:
```typescript
// EmptyState component
import { Package } from 'phosphor-react-native';

<View style={styles.emptyState}>
  <Package size={64} color="#E0E0E0" weight="regular" />
  <Text style={styles.emptyTitle}>Your cart is empty</Text>
  <Text style={styles.emptySubtitle}>Start adding items!</Text>
</View>
```

#### **Visual Guidelines for Illustrations**

**When to Use Illustrations**:
- ✅ **Onboarding**: Explain key concepts (4 carousel slides)
- ✅ **Feature Education**: First-time user guides, tooltips
- ✅ **Success States**: After completing major actions (listing published, trade complete)
- ✅ **Error States**: Friendly error messages (server error, no internet)
- ❌ **Regular Content**: Don't overuse - reserve for special moments

**Illustration Placement**:
- **Onboarding Carousel**: Center-aligned, 280x210pt, 24px margin from top
- **Modals**: Top section, 200x150pt, above title
- **Success Screens**: Full-width hero, 320x240pt
- **Error States**: Center-aligned, 240x180pt

**Color Usage in Custom Illustrations**:
- **Primary objects**: Whisk green (#5DBB8E)
- **Accent elements**: SP gold (#F59E0B)
- **Backgrounds**: White or very light tint (#F7F7F7)
- **Details**: Dark gray (#1A1A1A) for outlines, medium gray (#6B6B6B) for secondary elements

**Tone & Style**:
- Friendly, approachable, optimistic
- Diverse representation (different family types, ethnicities)
- Simple, clean linework (matches Phosphor Icons aesthetic)
- Minimal text in illustrations (text should be in UI, not image)

---

### AI Agent Usage Instructions

**For AI Agents Implementing Screens**:

1. **Icon Selection**:
   - Reference the table above for the specific use case
   - Use the exact icon name (case-sensitive)
   - Default to `weight="regular"` unless emphasizing (use `bold`) or showing active state (use `fill`)
   - Use color codes from the design system (avoid hardcoded colors)

2. **Import Statement**:
   ```typescript
   import { IconName1, IconName2, IconName3 } from 'phosphor-react-native';
   ```

3. **Illustration Usage**:
   - Check the illustration inventory table for available assets
   - Use exact filename (e.g., `onboarding-sp-earning.png`)
   - Follow dimension guidelines (don't scale arbitrarily)
   - For empty states, use Phosphor Icons instead of custom illustrations

4. **Fallback Strategy**:
   - If needed icon is NOT in curated list above, search full Phosphor Icons catalog at [phosphoricons.com](https://phosphoricons.com)
   - If NO suitable Phosphor icon exists, use a simple text label or ask for clarification

5. **Consistency Checks**:
   - ✅ Same icon used for same action across all screens (e.g., always `Trash` for delete)
   - ✅ Icon size appropriate for context (24px for tabs, 20px for buttons, 64px for empty states)
   - ✅ Color follows semantic meaning (green = primary/success, red = error/delete, gold = SP/rewards)

**Example Screen Implementation Prompt**:
```
Implement LoginScreen with:
- Email input with EnvelopeSimple icon (20px, gray #6B6B6B)
- Password input with Lock icon (20px, gray #6B6B6B)
- Show/hide password toggle using Eye/EyeSlash icons (20px, dark #1A1A1A)
- Social login buttons with circular icons (Apple, Google, Facebook - 50x50px)
- All using Phosphor Icons from phosphor-react-native package
```

---

## 🛠 CODE IMPLEMENTATION

### Pre-Implementation Cleanup

**Duplicate File Removal** (reference PHASE-0-AUDIT-RESULTS.md):

```bash
# 1. Archive .old files
mkdir -p archive/old-files
mv src/**/*.old archive/old-files/
git add archive/
git commit -m "Archive .old files before redesign"

# 2. Remove unused ConversationsScreen
git rm src/screens/ConversationsScreen.tsx
git commit -m "Remove unused ConversationsScreen"

# 3. Remove duplicate SpWalletScreen (keep src/screens/sp/SpWalletScreen.tsx)
# Verify no imports reference the duplicate first:
grep -r "from.*SpWalletScreen" src/
# If safe:
git rm src/screens/SpWalletScreen.tsx
git commit -m "Remove duplicate SpWalletScreen, keeping sp/ folder version"

# 4. Verify ProfileSetupScreen vs ProfileCompletionScreen usage
# Both are intentional variants per audit - NO ACTION
```

**Dependency Updates**:
```bash
# Remove Ionicons dependency (will be replaced by custom icons)
npm uninstall @expo/vector-icons

# Install icon support
npm install react-native-svg

# Update design system dependencies
npm install @shopify/restyle  # For design token theming
npm install react-native-reanimated  # For animations
```

---

### Design System Implementation

**Step 1: Create Theme Provider** (`src/theme/theme.ts`)

```typescript
import { createTheme } from '@shopify/restyle';

const theme = createTheme({
  colors: {
    // Primary Green (Whisk-inspired)
    green500: '#5DBB8E',      // Primary
    green400: '#7FCAA3',      // Light
    green600: '#4DAA7A',      // Dark
    green50: '#E8F5F0',       // Tint
    
    // Text colors
    textPrimary: '#1A1A1A',
    textSecondary: '#6B6B6B',
    textTertiary: '#999999',
    
    // Background
    background: '#FFFFFF',
    backgroundSecondary: '#F7F7F7',
    inputFilled: '#F0F0F0',
    
    // Semantic colors
    error: '#E85D75',
    warning: '#FFA726',
    info: '#5B8FB9',
    success: '#5DBB8E',
    
    // SP Gold
    spGold: '#F59E0B',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  textVariants: {
    'heading-h1': {
      fontFamily: 'Outfit-Bold',
      fontSize: 32,
      lineHeight: 40,
    },
    'heading-h2': {
      fontFamily: 'Outfit-SemiBold',
      fontSize: 24,
      lineHeight: 32,
    },
    'body-regular': {
      fontFamily: 'Inter-Regular',
      fontSize: 16,
      lineHeight: 24,
    },
    // ... all typography variants
  },
  borderRadii: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },
  breakpoints: {
    phone: 0,
    tablet: 768,
  },
});

export type Theme = typeof theme;
export default theme;
```

**Step 2: Implement Custom Icon Components** (`src/components/icons/`)

```typescript
// Example: HomeIcon.tsx
import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
}

export const HomeIcon: React.FC<IconProps> = ({ size = 24, color = '#000000' }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 12L5 10M5 10L12 3L19 10M5 10V20C5 20.5523 5.44772 21 6 21H9M19 10L21 12M19 10V20C19 20.5523 18.5523 21 18 21H15M9 21C9.55228 21 10 20.5523 10 20V16C10 15.4477 10.4477 15 11 15H13C13.5523 15 14 15.4477 14 16V20C14 20.5523 14.4477 21 15 21M9 21H15"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};
```

**Step 3: Create Reusable Components** (reference design-system.md)

```typescript
// Example: Button component
import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '@shopify/restyle';
import type { Theme } from '../theme/theme';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger';
type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'large',
  disabled = false,
  loading = false,
  icon,
}) => {
  const theme = useTheme<Theme>();
  
  // Variant styles based on design-system.md
  const variantStyles = {
    primary: {
      backgroundColor: theme.colors.orange600,
      borderColor: theme.colors.orange600,
      textColor: '#FFFFFF',
    },
    secondary: {
      backgroundColor: 'transparent',
      borderColor: theme.colors.orange600,
      textColor: theme.colors.orange600,
    },
    // ... other variants
  };
  
  // Size styles
  const sizeStyles = {
    large: {
      paddingVertical: 16,
      paddingHorizontal: 24,
      fontSize: 16,
      height: 56,
    },
    // ... other sizes
  };
  
  const variant Style = variantStyles[variant];
  const sizeStyle = sizeStyles[size];
  
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        {
          backgroundColor: variantStyle.backgroundColor,
          borderColor: variantStyle.borderColor,
          paddingVertical: sizeStyle.paddingVertical,
          paddingHorizontal: sizeStyle.paddingHorizontal,
          height: sizeStyle.height,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantStyle.textColor} />
      ) : (
        <>
          {icon && <View style={styles.icon}>{icon}</View>}
          <Text style={[styles.label, { color: variantStyle.textColor, fontSize: sizeStyle.fontSize }]}>
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 26, // Pill-shaped: height/2 (52px height → 26px radius)
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52, // Large button (Whisk spec)
  },
  label: {
    fontFamily: 'Outfit-SemiBold',
    fontWeight: '600',
    fontSize: 16,
  },
  icon: {
    marginRight: 8,
  },
});
```

**Step 3: Create Filled Input Component** (`src/components/ui/Input.tsx`)

```typescript
import React from 'react';
import { View, TextInput, Text, StyleSheet } from 'react-native';

export const Input: React.FC<{
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
}> = ({ label, value, onChangeText, placeholder, error }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error && styles.inputError]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#999999"
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: '#1A1A1A',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#F0F0F0', // Filled style (no border)
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 16,
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#1A1A1A',
  },
  inputError: {
    borderWidth: 1,
    borderColor: '#E85D75',
  },
  errorText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#E85D75',
    marginTop: 4,
  },
});
```

---

### Screen-by-Screen Implementation Order

**Implementation follows design system preparation** (see Section 2)

**Week 1: Foundation**
- [ ] Set up theme provider, Phosphor Icons, base components
- [ ] Implement FLOW-01 (Authentication screens)
- [ ] Implement FLOW-02 (Onboarding screens)
- [ ] Implement FLOW-03 (Location screens)
- [ ] Implement FLOW-06 (Discovery screens)

**Week 2: Marketplace**
- [ ] Implement FLOW-04 (Listing screens)
- [ ] Implement FLOW-07 (Cart screens) — NEW feature, backend required
- [ ] Implement FLOW-08 (Trade flow screens)

**Week 3: Loyalty**
- [ ] Implement FLOW-10 (SP Wallet screens)
- [ ] Implement FLOW-11 (SP Earn/Spend components)
- [ ] Implement FLOW-12 (Subscription screens)
- [ ] Implement FLOW-17 (Subscription events)

**Week 4: Communication**
- [ ] Implement FLOW-13 (Messaging screens)
- [ ] Implement FLOW-15 (Notification screens)
- [ ] Implement FLOW-16 (Support screens)

**Week 5: Growth & Safety**
- [ ] Implement FLOW-14 (Referral screens)
- [ ] Implement FLOW-18 (CPSC Recall screens)

---

### New Feature Implementation: FLOW-07 (Cart & Bundling)

**Backend Requirements** (Supabase):

**Database Schema**:
```sql
-- Cart table
CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  saved_for_later BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, item_id)
);

-- Cart checkout metadata (for multi-item tracking)
CREATE TABLE cart_checkouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  item_ids UUID[] NOT NULL,
  sp_allocation JSONB NOT NULL, -- {"item_id": sp_amount}
  total_sp_used INTEGER NOT NULL,
  total_cash_amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled'))
);
```

**Edge Functions**:
```typescript
// add-to-cart.ts
export async function addToCart(userId: string, itemId: string) {
  // Validation: item available, not own listing, not already in cart
  // Insert cart_items record
  // Return updated cart count
}

// checkout-cart.ts
export async function checkoutCart(
  userId: string,
  itemIds: string[],
  spAllocation: Record<string, number>,
  paymentMethodId: string
) {
  // For each item:
  //   1. Create trade record (existing trade flow)
  //   2. Process payment (Stripe)
  //   3. Allocate SP (deduct from user balance, hold in pending)
  // Create cart_checkouts record
  // Clear cart_items
  // Return trade IDs array
}
```

**Frontend Implementation**:
```typescript
// src/screens/cart/CartScreen.tsx
import { useCart } from '@/hooks/useCart';

export const CartScreen = () => {
  const { items, removeItem, checkout, loading } = useCart();
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  
  const handleCheckout = () => {
    navigation.navigate('CartCheckout', { itemIds: selectedItems });
  };
  
  // Render cart item cards with checkboxes, bulk actions
};

// src/screens/cart/CartCheckoutScreen.tsx
export const CartCheckoutScreen = ({ route }) => {
  const { itemIds } = route.params;
  const [spAllocation, setSpAllocation] = useState<Record<string, number>>({});
  const [allocationStrategy, setAllocationStrategy] = useState<'even' | 'custom'>('even');
  
  const handleConfirmPayment = async () => {
    const tradeIds = await checkoutCart(itemIds, spAllocation, paymentMethodId);
    navigation.navigate('CartCheckoutSuccess', { tradeIds });
  };
  
  // Render order summary, SP allocation UI, payment method
};
```

---

### Testing Strategy

**Unit Tests** (Jest):
- [ ] Theme provider renders correctly
- [ ] Button component variants render with correct styles
- [ ] Icon components render SVGs
- [ ] Cart hooks manage state correctly
- [ ] SP calculation utilities return correct values

**Integration Tests** (Supabase):
- [ ] Add to cart creates cart_items record
- [ ] Checkout cart creates multiple trades
- [ ] SP allocation deducts from balance and holds in pending
- [ ] Cart checkout creates cart_checkouts record

**E2E Tests** (Maestro):
- [ ] Complete signup → onboarding → location → Discover
- [ ] Create listing → publish → view in Discover
- [ ] Add item to cart → checkout → complete trade
- [ ] Add multiple items → allocate SP (custom) → checkout → track trades
- [ ] Subscribe to Premium → verify SP earning enabled

**Visual Regression Tests** (optional):
- [ ] Capture screenshots of all screens
- [ ] Compare against Figma exports
- [ ] Flag discrepancies for designer review

---

### Deployment Checklist

**Pre-Deployment**:
- [ ] All Figma screens implemented
- [ ] Design system 100% applied (no hardcoded colors/typography)
- [ ] Custom icons replace all Ionicons usage
- [ ] Cart feature fully functional (backend + frontend)
- [ ] All E2E tests passing
- [ ] No design system violations (run linter)

**Staged Rollout**:
- [ ] Deploy to TestFlight (iOS) / Internal Testing (Android)
- [ ] Gather feedback from 10-20 beta users
- [ ] Monitor crash reports (Sentry)
- [ ] Track user flows (analytics)
- [ ] Identify UX friction points

**Production Release**:
- [ ] Submit to App Store / Play Store
- [ ] Update app screenshots with new design
- [ ] Update marketing materials
- [ ] Announce redesign to existing users (in-app notification)

---

## 📊 PROJECT TIMELINE

**Estimated Duration**: **5 weeks implementation**

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **Code Implementation** | 5 weeks | Production-ready React Native app |
| Week 1 | 5 days | Theme setup, Phosphor Icons integration, base components, foundation flows (auth, onboarding) |
| Week 2 | 5 days | Marketplace flows (listings, cart, checkout) + backend/frontend integration |
| Week 3 | 5 days | Loyalty system flows (SP wallet, subscriptions, events) |
| Week 4 | 5 days | Communication flows (messaging, notifications, support) |
| Week 5 | 5 days | Growth/safety flows (referrals, recalls), testing, deployment |

**Critical Path**:
1. Phosphor Icons installation (gates component development)
2. Design system theme setup (gates all screen implementation)
3. Cart backend implementation (gates multi-item checkout)
4. Figma prototype completion (gates developer handoff)

**Risks & Mitigation**:
- **Risk**: Phosphor Icons integration issues → **Mitigation**: Fallback to react-native-vector-icons during development, migrate icons gradually
- **Risk**: Cart backend complexity → **Mitigation**: Allocate 2 developers, extra testing time
- **Risk**: Scope creep during implementation → **Mitigation**: Stick to 27 flows documented in screen-flow-mapping.md, defer new requests to post-launch

---

## 🎯 SUCCESS CRITERIA

**Asset Preparation**:
- ✅ Phosphor Icons installed and configured
- ✅ Storyset illustrations customized and optimized
- ✅ Design system theme tokens created

**Implementation Phase**:
- ✅ Theme provider with Whisk green design tokens active
- ✅ All Ionicons replaced with Phosphor Icons
- ✅ Cart feature fully functional (MVP-critical)
- ✅ All screens use filled inputs and pill buttons
- ✅ All E2E tests passing
- ✅ App deployed to production

**User Experience**:
- ✅ Signup → onboarding → first listing created < 5 minutes
- ✅ Discover → item detail → checkout < 2 minutes
- ✅ Multi-item cart checkout functional and intuitive
- ✅ SP earning/spending mechanics transparent
- ✅ Subscription upgrade flow frictionless
- ✅ Crash rate < 1% (tracked via Sentry)
- ✅ User feedback score > 4.5/5 (via in-app survey)

---

## 📚 REFERENCE DOCUMENTS

**Foundation Documents**:
1. [app-overview.md](./app-overview.md) — App concept, personas, business model
2. [design-system-passitup.md](./design-system-passitup.md) — Whisk-inspired design system
3. [screen-flow-mapping.md](./screen-flow-mapping.md) — 68 screens mapped to 27 flows
4. [figma-agent-prompts.md](./figma-agent-prompts.md) — Screen design documentation with field inventories

**Phase 0 Audit**:
- [PHASE-0-AUDIT-RESULTS.md](./PHASE-0-AUDIT-RESULTS.md) — Codebase audit, duplicate cleanup decisions

**External Resources**:
- [Whisk](https://whisk.com) — Design aesthetic reference
- [Phosphor Icons](https://phosphoricons.com) — Icon set ($49)
- [Storyset](https://storyset.com) — Illustrations (free)

---

## 🚀 NEXT STEPS

**Immediate Actions**:
1. **Purchase Phosphor Icons** — $49 for React Native icon pack
2. **Download Storyset illustrations** — Free, customize with brand colors
3. **Set up theme system** — Create theme.ts with Whisk green palette
4. **Install Phosphor Icons** — `npm install phosphor-react-native`
5. **Create base components** — Button (pill-shaped), Input (filled), OTP, Social Login

**Week 1 Goals**:
- [ ] Theme provider configured with green color palette
- [ ] Phosphor Icons installed and working
- [ ] Base UI components created (Button, Input)
- [ ] FLOW-01 (Authentication) screens implemented
- [ ] FLOW-02 (Onboarding) screens implemented with Storyset illustrations
- [ ] FLOW-03 (Location) screens implemented

---

**This implementation guide is now complete and ready for execution!** 🎉

If you have questions or need clarification on any section, please refer to the design-system-passitup.md or ask for assistance. Good luck with the implementation! 🚀
