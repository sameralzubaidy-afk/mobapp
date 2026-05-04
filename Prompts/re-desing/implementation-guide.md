# Implementation Guide: Pass It Up UX Redesign
**Phase 2 & 3 Execution Plan**  
*Last Updated: May 4, 2026*

---

## 📋 DOCUMENT OVERVIEW

This guide provides the complete roadmap for executing the Pass It Up UX redesign from Figma design through code implementation.

**Prerequisites**:
- ✅ Document 1: app-overview.md (App concept & business model)
- ✅ Document 2: design-system.md (Samsung Food design system)
- ✅ Document 3: screen-flow-mapping.md (68 screens mapped to 18 flows)
- ✅ Document 4: figma-agent-prompts.md (Copy-paste ready Figma prompts)

**Target Deliverables**:
- Complete Figma design system with all 68+ screens
- Production-ready React Native implementation
- Custom icon set replacing Ionicons
- Onboarding illustration assets
- Updated codebase with duplicate cleanup

---

## 🎯 PHASE 2: FIGMA DESIGN EXECUTION

### 2.1 Figma MCP + Copilot Studio Setup

**Tools Required**:
- Figma Professional account (with Make/Design features)
- VS Code with GitHub Copilot
- Figma MCP integration enabled

**Setup Steps**:

1. **Enable Figma MCP in VS Code**:
   - Open VS Code Settings (Cmd+,)
   - Search for "Copilot Agents"
   - Enable Figma MCP integration
   - Authenticate with Figma account

2. **Create Figma Project Structure**:
   ```
   Pass It Up - UX Redesign
   ├── 📄 Cover Page (project info, links to docs)
   ├── 🎨 Design System (from FLOW-00)
   ├── 📱 Screens (organized by flow)
   │   ├── FLOW-01: Authentication
   │   ├── FLOW-02: Onboarding
   │   ├── FLOW-03: Location
   │   └── ... (all 18 flows)
   ├── 🧩 Components (reusable library)
   └── 🔄 Prototypes (interactive flows)
   ```

3. **Import Foundation Documents**:
   - Upload app-overview.md, design-system.md, screen-flow-mapping.md to Figma project description
   - Link documents in Cover Page for easy reference
   - Create design system tokens from design-system.md

4. **Configure Figma Make Agent**:
   - Open Figma Make panel
   - For each flow, paste corresponding prompt from figma-agent-prompts.md
   - Reference format: "See app-overview.md Section 4.1 for SP earning rules"
   - Agent will auto-read linked documents

---

### 2.2 Figma Hygiene Checklist

**Naming Conventions**:
- **Screens**: `[FLOW-##]-[ScreenName]` (e.g., `FLOW-01-LoginScreen`)
- **Components**: `[Category]/[Name]` (e.g., `Button/Primary`, `Card/ItemCard`)
- **Variants**: Use Figma properties (Type, State, Size)
- **Colors**: Use design tokens from design-system.md (e.g., `Orange/600`, `Gray/50`)
- **Typography**: Use text styles (e.g., `Heading/H2`, `Body/Regular`)

**Layer Organization**:
```
Frame: [ScreenName]
├── Header (auto-layout, fixed to top)
├── Content (auto-layout, scrollable)
│   ├── Section 1
│   │   ├── Component Instance
│   │   └── Component Instance
│   └── Section 2
└── Footer/Actions (auto-layout, fixed to bottom)
```

**Component Best Practices**:
- ✅ Create variants for all state combinations (default, hover, pressed, disabled)
- ✅ Use auto-layout for responsive sizing
- ✅ Define 44x44px minimum touch targets
- ✅ Apply 8px grid system (snap to 8px)
- ✅ Use component properties for dynamic content (text, icons, images)
- ✅ Create instance swap properties for icons
- ✅ Document component usage in descriptions

**Prototype Configuration**:
- Use "Smart Animate" for transitions
- Set 300ms ease-in-out for most animations
- Configure overflow scrolling for long content
- Add bottom tab bar navigation to all applicable screens
- Link modal overlays to dismiss on background tap
- Configure keyboard navigation for form flows

---

### 2.3 Flow-by-Flow Implementation Order

**Recommended Implementation Sequence** (based on dependencies & priority):

#### **Week 1: Foundation & Core Navigation (P0)**

**Day 1-2: Design System Setup**
- [ ] **FLOW-00**: Create complete component library
  - Colors, typography, spacing tokens
  - Button variants (Primary, Secondary, Tertiary, Danger)
  - Card components (Item Card, Trade Card, Info Card)
  - Form inputs (Text Input, Dropdown, Date Picker, Slider)
  - Modals (Full-Overlay, Bottom-Sheet, Action-Sheet)
  - Navigation (Bottom Tabs, Header, Breadcrumbs)
  - Status badges, loading states, empty states

**Day 3-4: Authentication & Onboarding**
- [ ] **FLOW-01**: Authentication (7 screens)
  - Landing → Login → Signup → Phone Verification → Password Reset
  - Social login buttons, OTP input, error states
  - Test flow: Complete signup → verify phone → login
- [ ] **FLOW-02**: Onboarding (5 screens)
  - Welcome → Profile Completion → Feature Highlights → Education Carousel
  - Avatar upload, DOB picker, illustrated slides
  - Budget: $20-40 for custom illustrations (commission or purchase)
  - Test flow: New user completes onboarding → reaches Discover screen

**Day 5: Location & Discovery**
- [ ] **FLOW-03**: Node/ZIP Gating (2 screens)
  - ZIP input, radius slider, node selection cards
  - Test flow: Enter ZIP → select node → save location
- [ ] **FLOW-06**: Discovery (3 screens)
  - Discover feed, Category Browse, Item Detail
  - Search/filter modal, item carousel, SP earn badge
  - Test flow: Browse items → filter → view detail → navigate to checkout

#### **Week 2: Marketplace Core (P0)**

**Day 1-3: Listings**
- [ ] **FLOW-04**: Listing Management (5 screens)
  - ItemCreate (4-step stepper), BulkItemCreate, EditListing, MyListings, SafetyReview
  - Photo upload with drag-drop, category picker (hierarchical), fee summary
  - Test flow: Create listing → upload photos → set price → publish → edit → delete

**Day 4-5: Cart & Checkout**
- [ ] **FLOW-07**: Cart & Bundling (2 screens) ⭐ NEW MVP-critical
  - CartScreen, CartCheckoutScreen
  - Multi-item checkout, SP allocation strategies (even vs. custom)
  - Test flow: Add multiple items to cart → allocate SP → checkout → success
- [ ] **FLOW-08**: Trade Flow (6 screens)
  - Trade initiation, detail, list, timeline, success, active trades
  - 5-step timeline component, state-specific actions
  - Test flow: Single-item checkout → track trade → mark complete → rate

#### **Week 3: Loyalty & Revenue (P0/P1)**

**Day 1-2: SP System**
- [ ] **FLOW-10**: SP Wallet (3 screens)
  - Balance view, transaction history, breakdown
  - Gradient hero card, transaction filtering, pending release timeline
  - Test flow: View balance → see breakdown → view transaction detail
- [ ] **FLOW-11**: SP Earn/Spend (integrated components)
  - SP earn badge (compact + expanded), calculation tooltip
  - Subscription tier comparison modal
  - Test flow: View item → see SP badge → tap for calculation → subscribe

**Day 3-4: Subscriptions**
- [ ] **FLOW-12**: Subscription Management (4 screens)
  - Management, upgrade, cancellation, success
  - Tier comparison cards, billing info, trial banners
  - Test flow: View plans → start trial → upgrade → manage → cancel
- [ ] **FLOW-17**: Subscription Events (3 screens)
  - Trial alerts, payment reminders, tier change confirmation
  - Integrated with FLOW-12 and notification system
  - Test flow: Trial ending alert → upgrade prompt → payment success

#### **Week 4: Communication & Support (P1)**

**Day 1-2: Messaging**
- [ ] **FLOW-13**: Messaging & Coordination (3 screens)
  - Conversation list, chat interface, trade context panel
  - Message bubbles, quick replies, attachment support
  - Test flow: Start conversation → send messages → share listing → coordinate pickup

**Day 3-4: Notifications & Support**
- [ ] **FLOW-15**: Notifications (3 screens)
  - Notification list, settings, push preferences
  - Grouped notifications, swipe actions, mark all read
  - Test flow: Receive notification → view detail → configure preferences
- [ ] **FLOW-16**: Support & Help Center (4 screens)
  - Help home, article detail, contact support, ticket submission
  - Searchable FAQ, category navigation, ticket tracking
  - Test flow: Search help → read article → submit ticket → view response

#### **Week 5: Growth & Safety (P1/P2)**

**Day 1-2: Referrals & Safety**
- [ ] **FLOW-14**: Referral Program (2 screens)
  - Referral dashboard, code sharing modal
  - Progress tracking, reward claims, social sharing
  - Test flow: Generate code → share → track referral → claim reward
- [ ] **FLOW-18**: CPSC Recalls & Admin Actions (4 screens)
  - Admin recall creation, user recall alert, appeal submission, admin appeal review
  - Recall details card, affected listings, appeal flow
  - Test flow: Admin creates recall → user receives alert → submits appeal → admin reviews

**Day 3-5: Polish & Cross-Flow Testing**
- [ ] Create all interactive prototypes linking flows
- [ ] Test complete user journeys (see Section 2.4)
- [ ] Validate design system consistency across all screens
- [ ] Export assets (icons, illustrations, images)
- [ ] Prepare developer handoff package

---

### 2.4 Testing Cadence & Validation

**Daily Review Checklist**:
- [ ] All screens use design tokens (no hardcoded colors/typography)
- [ ] Touch targets meet 44x44px minimum
- [ ] Auto-layout applied consistently (no absolute positioning)
- [ ] Components linked to library (not detached)
- [ ] Prototype flows navigate correctly
- [ ] Modals dismiss properly
- [ ] Forms validate inputs
- [ ] Empty states designed for all list views
- [ ] Loading states designed for async operations
- [ ] Error states designed for failures

**Weekly Cross-Flow Validation**:

**Week 1 Checkpoint**: Foundation flows functional
- [ ] Complete user signup → onboarding → location selection → reach Discover
- [ ] All design system components documented and reusable
- [ ] Bottom tab navigation consistent across screens

**Week 2 Checkpoint**: Marketplace flows complete
- [ ] Create listing → publish → view in Discover → edit → delete
- [ ] Add to cart → checkout (single item) → complete trade → rate seller
- [ ] Multi-item cart → allocate SP → checkout → track multiple trades

**Week 3 Checkpoint**: Loyalty system integrated
- [ ] View SP balance → see breakdown → view transaction history
- [ ] Subscribe to Premium → verify SP earning enabled → upgrade to Pro
- [ ] Sell item → earn SP → track pending release → SP available

**Week 4 Checkpoint**: Communication flows functional
- [ ] Send message to seller → coordinate pickup → complete trade
- [ ] Receive notification → view detail → navigate to source (trade/message/etc)
- [ ] Submit support ticket → receive response → view in ticket list

**Week 5 Final Validation**: Complete user journeys
- [ ] **New User Journey**: Signup → onboard → select location → subscribe → create listing → sell item → earn SP → get paid
- [ ] **Buyer Journey**: Discover item → view detail → add to cart → allocate SP → checkout → complete trade → rate seller
- [ ] **Multi-Item Journey**: Add 3 items to cart → allocate SP (custom strategy) → checkout → coordinate pickups → complete trades
- [ ] **Referral Journey**: Share code → friend signs up → track referral → claim reward
- [ ] **Support Journey**: Search help → submit ticket → receive response → resolve issue
- [ ] **Safety Journey**: Admin creates recall → user receives alert → submits appeal → admin reviews

---

### 2.5 Asset Preparation

#### **Custom Icon Set** ($100 budget allocated)

**Requirements**:
- **Quantity**: ~100 unique icons (replace all Ionicons usage)
- **Style**: Line icons, 2px stroke weight, rounded caps
- **Sizes**: 20px, 24px, 32px (default 24px)
- **Format**: SVG (optimized, single color)
- **Color**: Designed in black (#000000), will be colored via CSS/props

**Icon Categories** (reference current Ionicons usage):
- Navigation: home, search, messages, profile, back, forward, menu
- Actions: add, edit, delete, share, bookmark, filter, sort
- Commerce: cart, price-tag, wallet, coin, receipt
- Communication: send, attach, emoji, call, video
- Status: checkmark, close, alert, info, warning, success
- Media: camera, image, play, pause, upload
- Social: heart, star, thumbs-up, flag, shield
- Misc: location, calendar, clock, settings, help

**Sourcing Options**:
1. **Commission Custom Set**: Fiverr/Upwork icon designer ($80-100, 3-5 day turnaround)
   - Pros: Unique, perfectly aligned with brand
   - Cons: Longer timeline, revision cycles
2. **Purchase Icon Pack**: Streamline Icons, Phosphor Icons, Lucide Icons ($30-60)
   - Pros: Immediate, consistent, comprehensive
   - Cons: Less unique, may need customization
3. **Mix Approach**: Purchase base pack ($40) + commission custom icons ($60) for unique needs
   - Pros: Balance of speed and customization
   - Cons: Potential style inconsistency

**Recommended**: Purchase **Phosphor Icons** pack ($49) — matches design system aesthetic, 6,000+ icons, regular updates, React Native support.

**Implementation**:
- Export SVGs from Figma with "Include 'id' attribute" unchecked
- Optimize with SVGO (remove unnecessary attributes)
- Create React Native components using `react-native-svg`
- Organize: `src/components/icons/[IconName].tsx`

#### **Onboarding Illustrations** ($20-40 budget)

**Requirements**:
- **Quantity**: 3-4 illustrations for FLOW-02 Feature Highlights
- **Style**: Friendly, colorful, modern (aligned with Samsung Food aesthetic)
- **Themes**:
  1. Swap Points earning (coins, rewards, celebration)
  2. Safe local trading (handshake, location, shield)
  3. Kids items marketplace (toys, clothes, books, happy families)
  4. Sustainable reuse (recycling, earth, growth)
- **Size**: ~400x300px (2x resolution for retina)
- **Format**: PNG with transparency OR SVG

**Sourcing Options**:
1. **Commission Illustrator**: Fiverr ($20-40 for 4 illustrations, 2-3 day turnaround)
2. **Purchase Illustration Pack**: Storyset, unDraw ($0-30 for customizable sets)
3. **AI Generation**: Midjourney/DALL-E ($10-20 for prompts + editing)

**Recommended**: **Storyset** — free customizable illustrations with color palette matching, commercial license included.

**Implementation**:
- Export from Figma at 2x resolution
- Optimize PNGs with ImageOptim or TinyPNG
- Store in `src/assets/illustrations/`
- Reference in FeatureHighlightsScreen carousel

#### **Other Assets**

**Empty State Illustrations** (optional, $0-20):
- Empty cart, no messages, no transactions, no listings
- Can use icons + text OR simple illustrations
- Recommended: Use custom icon set + typography (no additional cost)

**App Icon & Splash Screen** (deferred to Phase 3):
- Will be designed after Figma screens complete
- Requires brand mark/logo (not in current scope)
- Budget: TBD

---

### 2.6 Developer Handoff Package

**Export Checklist**:

**Design Files**:
- [ ] Figma file link with edit access for developers
- [ ] PDF export of all screens (for quick reference)
- [ ] Design system style guide (auto-generated from Figma)

**Assets**:
- [ ] Custom icon set (SVG folder + React Native components)
- [ ] Onboarding illustrations (PNG 2x + 3x)
- [ ] Component specifications (spacing, sizing, variants)

**Documentation**:
- [ ] app-overview.md (product context)
- [ ] design-system.md (design tokens, component specs)
- [ ] screen-flow-mapping.md (screen inventory, flow logic)
- [ ] figma-agent-prompts.md (design intent for each flow)
- [ ] implementation-guide.md (this document)

**Prototypes**:
- [ ] Share interactive Figma prototype links for each flow
- [ ] Embed prototype videos for key user journeys (optional)

**Design Tokens Export**:
- [ ] Colors (JSON format for React Native theme)
- [ ] Typography scales (font sizes, weights, line heights)
- [ ] Spacing values (8px grid system)
- [ ] Border radius values
- [ ] Shadow styles

**Example Design Token Export** (`design-tokens.json`):
```json
{
  "colors": {
    "primary": {
      "50": "#FFF4F0",
      "100": "#FFE9E0",
      "200": "#FFD3C1",
      "300": "#FFBDA2",
      "400": "#FFA783",
      "500": "#FF9164",
      "600": "#FF6B35",
      "700": "#E85A1F",
      "800": "#CC4A0F",
      "900": "#B03A00"
    },
    "secondary": {
      "50": "#E6F7F5",
      "...": "..."
    }
  },
  "typography": {
    "heading": {
      "display-1": {"size": 32, "weight": 700, "lineHeight": 40},
      "h1": {"size": 28, "weight": 700, "lineHeight": 36},
      "...": "..."
    }
  },
  "spacing": [0, 4, 8, 12, 16, 24, 32, 48, 64],
  "borderRadius": {
    "sm": 8,
    "md": 12,
    "lg": 16,
    "xl": 24,
    "full": 9999
  }
}
```

---

## 🛠 PHASE 3: CODE IMPLEMENTATION

### 3.1 Pre-Implementation Cleanup

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

### 3.2 Design System Implementation

**Step 1: Create Theme Provider** (`src/theme/theme.ts`)

```typescript
import { createTheme } from '@shopify/restyle';

// Import design tokens from Figma export
import designTokens from './design-tokens.json';

const theme = createTheme({
  colors: {
    // Primary Orange
    orange50: '#FFF4F0',
    orange600: '#FF6B35',
    // ... all color tokens
    
    // Semantic colors
    textPrimary: '#1F2937',  // gray-900
    textSecondary: '#6B7280', // gray-600
    background: '#FFFFFF',
    error: '#EF4444',
    success: '#10B981',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48,
  },
  textVariants: {
    'heading-display-1': {
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
    borderRadius: 12,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44, // Touch target minimum
  },
  label: {
    fontFamily: 'Inter-SemiBold',
    fontWeight: '600',
  },
  icon: {
    marginRight: 8,
  },
});
```

---

### 3.3 Screen-by-Screen Implementation Order

**Implementation follows Figma completion order** (see Section 2.3)

**Week 1: Foundation**
- [ ] Set up theme provider, custom icons, base components
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

### 3.4 New Feature Implementation: FLOW-07 (Cart & Bundling)

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

### 3.5 Testing Strategy

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

### 3.6 Deployment Checklist

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

**Estimated Duration**: 5 weeks design + 5 weeks implementation = **10 weeks total**

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **Phase 2: Figma Design** | 5 weeks | Complete design system, 68+ screens, prototypes, assets |
| Week 1 | 5 days | Foundation, auth, onboarding, location, discovery |
| Week 2 | 5 days | Listings, cart, trade flow |
| Week 3 | 5 days | SP wallet, subscriptions, events |
| Week 4 | 5 days | Messaging, notifications, support |
| Week 5 | 5 days | Referrals, safety, polish, handoff |
| **Phase 3: Code Implementation** | 5 weeks | Production-ready React Native app |
| Week 1 | 5 days | Theme, icons, base components, foundation flows |
| Week 2 | 5 days | Marketplace flows + cart backend/frontend |
| Week 3 | 5 days | Loyalty system flows |
| Week 4 | 5 days | Communication flows |
| Week 5 | 5 days | Growth/safety flows, testing, deployment |

**Critical Path**:
1. Design system completion (gates all screen design)
2. Custom icon procurement (gates code implementation)
3. Cart backend implementation (gates multi-item checkout)
4. Figma prototype completion (gates developer handoff)

**Risks & Mitigation**:
- **Risk**: Custom icon delivery delay → **Mitigation**: Purchase icon pack instead of commission
- **Risk**: Figma MCP integration issues → **Mitigation**: Manual design as fallback
- **Risk**: Cart backend complexity → **Mitigation**: Allocate 2 developers, extra testing time
- **Risk**: Scope creep during design → **Mitigation**: Stick to 18 flows in figma-agent-prompts.md, defer new requests to Phase 4

---

## 🎯 SUCCESS CRITERIA

**Design Phase (Phase 2)**:
- ✅ All 68+ screens designed in Figma
- ✅ Design system 100% applied (no violations)
- ✅ Interactive prototypes for all 18 flows
- ✅ Custom icon set integrated (100+ icons)
- ✅ Onboarding illustrations created (3-4 illustrations)
- ✅ Developer handoff package complete

**Implementation Phase (Phase 3)**:
- ✅ Theme provider with design tokens active
- ✅ All Ionicons replaced with custom icons
- ✅ Cart feature fully functional (MVP-critical)
- ✅ All screens match Figma designs (90%+ visual parity)
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

**Phase 1 Deliverables** (foundation):
1. [app-overview.md](./app-overview.md) — App concept, personas, business model
2. [design-system.md](./design-system.md) — Samsung Food design system
3. [screen-flow-mapping.md](./screen-flow-mapping.md) — 68 screens mapped to 18 flows
4. [figma-agent-prompts.md](./figma-agent-prompts.md) — Copy-paste ready Figma prompts

**Phase 0 Audit**:
- [PHASE-0-AUDIT-RESULTS.md](./PHASE-0-AUDIT-RESULTS.md) — Codebase audit, duplicate cleanup decisions

**External Resources**:
- [Samsung Food](https://samsungfood.com) — Design aesthetic reference
- [Phosphor Icons](https://phosphoricons.com) — Recommended icon set
- [Storyset](https://storyset.com) — Recommended illustration source
- [Figma MCP Documentation](https://www.figma.com/mcp-docs) — Integration guide

---

## 🚀 NEXT STEPS

**Immediate Actions**:
1. **Set up Figma project** — Create folder structure, upload docs
2. **Purchase custom icon set** — Phosphor Icons ($49)
3. **Source onboarding illustrations** — Storyset (free)
4. **Begin FLOW-00 (Design System)** — Create component library
5. **Schedule weekly checkpoints** — Review progress, validate quality

**Week 1 Goals**:
- [ ] Figma project set up with all foundation documents
- [ ] FLOW-00 (Design System) complete
- [ ] FLOW-01 (Authentication) complete
- [ ] FLOW-02 (Onboarding) complete with illustrations
- [ ] FLOW-03 (Location) complete
- [ ] FLOW-06 (Discovery) complete
- [ ] All Week 1 screens prototyped and validated

---

**This implementation guide is now complete and ready for execution!** 🎉

If you have questions or need clarification on any section, please refer to the source documents or ask for assistance. Good luck with the redesign! 🚀
