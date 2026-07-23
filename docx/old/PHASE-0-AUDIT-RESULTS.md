# Phase 0: Codebase Audit Results
**UX Redesign Foundation Data**  
**Date**: May 3, 2026  
**App**: Pass It Up (Kids P2P Marketplace)  
**Scope**: Customer-facing screens only (admin excluded)

---

## Executive Summary

- **Total Screens Found**: 74 files
- **Customer Screens**: 68 (excluding 6 admin screens)
- **Documented Flows**: 45 flows in flow-registry.md
- **Current Design System**: Minimal (basic colors, Ionicons, system fonts)
- **Navigation Pattern**: Stack Navigator + Bottom Tab Navigator (2 tabs: Dashboard, Discover)
- **Icon Library**: Ionicons from @expo/vector-icons
- **Typography**: System default (no custom fonts)
- **Photography**: User-generated content (no professional assets)

---

## 1. Screen Inventory (68 Customer Screens)

### 1.1 Authentication & Onboarding (13 screens)
**Flow**: FLOW-01 (Auth), FLOW-02 (Profiles & Onboarding)

- `LoginScreen.tsx` (2 versions: active + .old)
- `SignupScreen.tsx` (2 versions: active + .old)
- `PhoneVerificationScreen.tsx`
- `ForgotPasswordScreen.tsx`
- `ResetPasswordScreen.tsx`
- `LandingScreen.tsx`
- `SuspendedAccountScreen.tsx`
- `WelcomeScreen.tsx`
- `OnboardingScreen.tsx` (trading education carousel - MODULE-18 EDU-004)
- `FeatureHighlightsScreen.tsx`
- `ProfileCompletionScreen.tsx`
- `ProfileSetupScreen.tsx`
- `LocationPickerScreen.tsx`

**Design Gaps**:
- Login/Signup screens have .old versions (inconsistent patterns)
- Minimal visual hierarchy on auth screens
- No brand presence (logo placeholder needed)

---

### 1.2 Discovery & Browse (3 screens)
**Flow**: FLOW-06 (Discovery – Feed/Search/Filters/Favorites)

- `DiscoverScreen.tsx` (unified search + browse - DISCOVERY-V3-005)
- `CategoryBrowseScreen.tsx`
- `ItemDetailScreen.tsx`

**Design Gaps**:
- Search/filter UI uses basic inputs
- No visual polish on item cards
- Category browse lacks visual differentiation

---

### 1.3 Listing Management (6 screens)
**Flow**: FLOW-04 (Listings), FLOW-05 (Media Upload)

- `ItemCreateScreen.tsx` (root level)
- `CreateListingScreen.tsx` (in listing/)
- `BulkListingCreateScreen.tsx`
- `EditListingScreen.tsx`
- `MyListingsScreen.tsx`
- `ListingSafetyReviewScreen.tsx`

**Design Gaps**:
- Two create screens (ItemCreateScreen vs CreateListingScreen) - unclear pattern
- Bulk listing UI needs visual polish
- Photo upload UI basic (no preview grid refinement)

---

### 1.4 Trading & Checkout (7 screens)
**Flow**: FLOW-08 (Trade Flow), FLOW-09 (Fees & Pricing)

- `TradeInitiationScreen.tsx`
- `TradeDetailScreen.tsx`
- `TradeListScreen.tsx`
- `TradeTimelineScreen.tsx`
- `TradeSuccessScreen.tsx`
- `ActiveTradesScreen.tsx`
- `SubmitReviewScreen.tsx`

**Design Gaps**:
- Trade timeline lacks visual polish
- Success screen needs celebration moment
- Review submission basic form

---

### 1.5 Messaging (3 screens)
**Flow**: FLOW-14 (Messaging - Realtime)

- `ConversationsListScreen.tsx`
- `ConversationsScreen.tsx` (duplicate?)
- `ChatScreen.tsx`

**Design Gaps**:
- Two conversation list screens (redundant?)
- Chat bubbles need visual refinement
- No read receipts/typing indicators UI

---

### 1.6 Profile & Settings (14 screens)
**Flow**: FLOW-02 (Profiles), FLOW-21 (ID Verification)

- `ProfileScreen.tsx`
- `EditProfileScreen.tsx`
- `ProfileSetupScreen.tsx` (duplicate with onboarding?)
- `BadgesScreen.tsx`
- `LeaderboardScreen.tsx`
- `IDVerificationUploadScreen.tsx`
- `LinkedAccountsScreen.tsx` (AUTH-V3-008 social login)
- `SettingsScreen.tsx`
- `NotificationPreferencesScreen.tsx`
- `TermsOfServiceScreen.tsx`
- `PrivacyPolicyScreen.tsx`
- `LiabilityDisclaimerScreen.tsx`
- `TransactionHistoryScreen.tsx`
- `SpWalletScreen.tsx` (2 locations: profile/ + sp/)

**Design Gaps**:
- Duplicate screens (ProfileSetupScreen in both profile/ and onboarding/)
- Legal screens (ToS, Privacy) plain text - need formatting
- Wallet screen needs visual hierarchy for balance/transactions

---

### 1.7 Subscription & Billing (7 screens)
**Flow**: FLOW-12 (Subscriptions), FLOW-12A (Payment Collection)

- `SubscriptionChoiceScreen.tsx`
- `SubscriptionPaymentScreen.tsx`
- `SubscriptionStatusScreen.tsx`
- `SubscriptionSuccessScreen.tsx`
- `ContinueKidsClubScreen.tsx`
- `ManageKidsClubScreen.tsx`
- `KidsClubOverviewScreen.tsx`
- `BillingHistoryScreen.tsx`

**Design Gaps**:
- Subscription choice needs visual tier comparison
- Payment screen basic Stripe integration
- Success screen lacks celebration moment

---

### 1.8 Seller & Payouts (2 screens)
**Flow**: FLOW-22 (Seller Payouts), FLOW-23 (Payout Verification)

- `PayoutSettingsScreen.tsx`
- `SellerEarningsScreen.tsx`

**Design Gaps**:
- Earnings dashboard needs charts/visual data
- Payout settings basic form

---

### 1.9 Dashboard & Home (2 screens)
**Flow**: Multiple (Dashboard aggregates multiple flows)

- `UserDashboardScreen.tsx`
- `RecentTradeCard.tsx` (component in dashboard/)

**Design Gaps**:
- Dashboard lacks visual hierarchy
- Recent trades card basic styling
- No data visualization

---

### 1.10 Miscellaneous (4 screens)

- `HelpScreen.tsx` (FLOW-19 Trading Education)
- `NotificationCenterScreen.tsx` (FLOW-17 Notifications)
- `ReferralDashboardScreen.tsx` (FLOW-13 Referrals)
- `UnsubscribeScreen.tsx`
- `NodeSelectionScreen.tsx` (FLOW-03 Node/ZIP Gating)

**Design Gaps**:
- Help screen plain text
- Notification center needs visual polish
- Referral dashboard lacks gamification UI

---

### 1.11 Admin Screens (6 screens - EXCLUDED from redesign)

- `AdminDashboardScreen.tsx`
- `ModerationQueueScreen.tsx`
- `NodeManagementScreen.tsx`
- `ReviewModerationScreen.tsx`
- `TrialConversionTestScreen.tsx`
- `TrialExtensionTestScreen.tsx`

**Note**: Admin portal out of scope per user requirement.

---

## 2. Component Structure Analysis

### 2.1 Reusable Components (Top-Level)

**Location**: `p2p-kids-marketplace/src/components/`

**Files Found**:
- `BadgeShowcase.tsx`
- `DateOfBirthPicker.tsx`
- `DisclaimerModal.tsx`
- `GracePeriodBanner.tsx`
- `NotificationSetup.tsx`
- `RadiusSlider.tsx`
- `ReviewCard.tsx`
- `StarRating.tsx`
- `StartupDebugOverlay.tsx`
- `TrialReminderBanner.tsx`

**Component Folders**:
- `atoms/` (basic building blocks)
- `molecules/` (composite components)
- `organisms/` (complex components)
- `auth/` (social login buttons, phone verification modal - AUTH-V3-008)
- `badges/`
- `bulk/`
- `discovery/`
- `education/`
- `listing/`
- `modals/`
- `onboarding/`
- `shared/`
- `subscription/`

### 2.2 Component Patterns Observed

**Icon Usage**:
- Ionicons from @expo/vector-icons used across 17+ screens
- Emoji fallbacks in tab navigator (🏠 🔍 💬 👤)
- No custom icon set

**Modal Patterns**:
- DisclaimerModal
- PhoneVerificationModal (AUTH-V3-008)
- AccountLinkingPrompt (AUTH-V3-008)
- SetPasswordModal (AUTH-V3-008)

**Banner Patterns**:
- GracePeriodBanner
- TrialReminderBanner

**Form Components**:
- DateOfBirthPicker
- RadiusSlider
- StarRating

### 2.3 Styling Patterns

**Current Theme** (`src/theme.ts`):
```typescript
export const theme = {
  colors: {
    primary: 'blue',
    text: { primary: 'black', secondary: 'gray' },
    background: 'white',
    surface: 'white',
    border: 'gray',
    success: 'green',
    error: 'red',
  },
};
```

**Critical Gaps**:
- No color palette specification (just basic names)
- No typography scale
- No spacing system
- No component sizing standards
- No shadow/elevation system
- No animation/transition standards

---

## 3. Flow-to-Screen Mapping

### 3.1 Flow Registry Summary

**Total Flows**: 45 documented in `docs/flow-registry.md` (1900+ lines)

**Top 20 Customer-Facing Flows**:

1. **FLOW-00**: Infrastructure & Environment Health
2. **FLOW-01**: Auth – Signup/Login/Logout/Session Restore
   - Screens: LoginScreen, SignupScreen, PhoneVerificationScreen, ForgotPasswordScreen, ResetPasswordScreen
3. **FLOW-02**: Profiles & Onboarding
   - Screens: ProfileSetupScreen, ProfileCompletionScreen, WelcomeScreen, FeatureHighlightsScreen
4. **FLOW-03**: Node/ZIP Gating + Waitlist
   - Screens: NodeSelectionScreen, LocationPickerScreen
5. **FLOW-04**: Listings – Create/Edit/Delete/Expire/Soft Delete
   - Screens: ItemCreateScreen, CreateListingScreen, EditListingScreen, MyListingsScreen
6. **FLOW-05**: Media Upload (Storage) – Listing Photos
   - Screens: ItemCreateScreen (photo picker integration)
7. **FLOW-06**: Discovery – Feed/Search/Filters/Favorites
   - Screens: DiscoverScreen, CategoryBrowseScreen, ItemDetailScreen
8. **FLOW-07**: Cart & Bundling (if implemented)
   - Screens: TBD (not found in current codebase)
9. **FLOW-08**: Trade Flow – Checkout + Transaction State Machine
   - Screens: TradeInitiationScreen, TradeDetailScreen, TradeTimelineScreen, TradeSuccessScreen
10. **FLOW-09**: Fees & Pricing Engine
    - Screens: TradeInitiationScreen (shows fee breakdown)
11. **FLOW-10**: Swap Points Wallet – Read + Ledger Integrity
    - Screens: SpWalletScreen, TransactionHistoryScreen
12. **FLOW-11**: Swap Points – Earn/Spend/Cap + Pending→Release
    - Screens: SpWalletScreen
13. **FLOW-12**: Subscriptions – Purchase/Cancel/Grace Period
    - Screens: SubscriptionChoiceScreen, SubscriptionPaymentScreen, SubscriptionStatusScreen, ManageKidsClubScreen
14. **FLOW-12A**: Subscription Payment Collection (Stripe)
    - Screens: SubscriptionPaymentScreen
15. **FLOW-13**: Referrals – Code Generation + Apply On Signup
    - Screens: ReferralDashboardScreen
16. **FLOW-14**: Messaging (Realtime)
    - Screens: ConversationsListScreen, ChatScreen
17. **FLOW-16**: CPSC Recall Matching – Item Safety Check
    - Screens: ListingSafetyReviewScreen
18. **FLOW-17**: Notifications
    - Screens: NotificationCenterScreen, NotificationPreferencesScreen
19. **FLOW-18**: Admin Controls (EXCLUDED)
    - Screens: Admin screens excluded
20. **FLOW-19**: Trading Education – Onboarding, Help Content
    - Screens: OnboardingScreen, HelpScreen

### 3.2 Screen-to-Flow Dependency Matrix

| Flow | Screens | Priority | Redesign Impact |
|------|---------|----------|-----------------|
| FLOW-01 (Auth) | 7 screens | **CRITICAL** | High - First user touchpoint |
| FLOW-02 (Onboarding) | 5 screens | **CRITICAL** | High - User retention driver |
| FLOW-06 (Discovery) | 3 screens | **CRITICAL** | High - Core UX loop |
| FLOW-04 (Listings) | 5 screens | **CRITICAL** | High - Seller activation |
| FLOW-08 (Trading) | 6 screens | **CRITICAL** | High - Transaction completion |
| FLOW-12 (Subscriptions) | 7 screens | **HIGH** | Medium - Revenue driver |
| FLOW-14 (Messaging) | 3 screens | **HIGH** | Medium - User engagement |
| FLOW-10/11 (SP Wallet) | 2 screens | **MEDIUM** | Medium - Gamification |
| FLOW-13 (Referrals) | 1 screen | **MEDIUM** | Low - Growth mechanic |
| FLOW-19 (Education) | 2 screens | **LOW** | Low - Support content |

### 3.3 Missing Flows (Documented but No Screens Found)

- **FLOW-07**: Cart & Bundling - No cart screen found
- **FLOW-18**: CPSC Recall Imports - Admin-only (correct)
- **FLOW-20**: Audit/Logging - Backend-only (correct)
- **FLOW-21**: ID Verification - Has upload screen, missing admin review screens (admin excluded)
- **FLOW-22**: Seller Payouts - Has screens (PayoutSettingsScreen, SellerEarningsScreen)
- **FLOW-23**: Payout Method Verification - Integrated into PayoutSettingsScreen

### 3.4 Unmapped Screens (Found but Not in Flow Registry)

- `NodeManagementScreen.tsx` (admin - correct exclusion)
- `TrialConversionTestScreen.tsx` (admin test - correct exclusion)
- `TrialExtensionTestScreen.tsx` (admin test - correct exclusion)
- `UnsubscribeScreen.tsx` (email unsubscribe - minor flow)
- `LiabilityDisclaimerScreen.tsx` (legal - minor flow)

---

## 4. Design Asset Inventory

### 4.1 Color Usage Audit

**Current Colors** (from theme.ts):
- `primary`: 'blue' (hex value undefined)
- `text.primary`: 'black'
- `text.secondary`: 'gray'
- `background`: 'white'
- `surface`: 'white'
- `border`: 'gray'
- `success`: 'green'
- `error`: 'red'

**Tab Navigator Accent** (from HomeTabNavigator.tsx):
- `tabBarActiveTintColor`: '#007AFF' (iOS default blue)
- `tabBarInactiveTintColor`: '#666' (medium gray)

**Gaps**:
- No hex/RGB values for primary colors
- No secondary/accent color defined
- No semantic colors (warning, info, disabled)
- No color opacity/alpha variants
- No dark mode palette

### 4.2 Icon Inventory

**Current Library**: Ionicons from @expo/vector-icons

**Usage Patterns** (17+ screens using Ionicons):
- Navigation icons (back, close, menu)
- Action icons (edit, delete, share)
- Status icons (checkmark, alert, info)
- Social icons (Google, Facebook, Apple - text labels in AUTH-V3-007)

**Tab Navigator Icons** (emoji fallbacks):
- Dashboard: 🏠
- Discover: 🔍
- Messages: 💬
- Profile: 👤

**Gaps**:
- No custom icon set
- No brand-specific icons
- Social login buttons use text labels (no official brand assets)
- Emoji fallbacks not production-ready

**Budget Allocation** ($100 total):
- Custom icon set: ~$40-60 (IconScout, Noun Project)
- Social login official icons: Free (brand guidelines)
- Remaining: $40-60 for illustrations/graphics

### 4.3 Typography Audit

**Current Font**: System default (no custom fonts specified)

**Gaps**:
- No font family specification
- No type scale (H1, H2, body, caption, etc.)
- No line height standards
- No letter spacing
- No font weight variants

**Recommendation**: 
- Primary font: TBD based on Samsung Food inspiration
- System fallback: San Francisco (iOS), Roboto (Android)

### 4.4 Photography & Graphics

**Current Approach**: User-generated content only

**Assets Found**:
- No professional photography
- No hero images
- No onboarding illustrations
- No empty state graphics
- No celebration/success moment graphics

**Budget Note**: User requested no professional photography (used items marketplace - authentic UGC preferred)

**Opportunities**:
- Empty state illustrations ($0 - can use free sets like unDraw)
- Success moment graphics ($20-40 from design marketplaces)
- Onboarding carousel illustrations ($20-40)

---

## 5. Navigation & Flow Analysis

### 5.1 Navigation Architecture

**Pattern**: Stack Navigator + Bottom Tab Navigator

**App Entry** (`App.tsx`):
```
GestureHandlerRootView
  └─ SafeAreaProvider
      └─ AppNavigator (Stack Navigator)
          └─ HomeTabNavigator (Bottom Tabs)
```

**Stack Navigator** (from AppNavigator.tsx):
- **Unauthenticated Stack**: Landing → Login → Signup → ForgotPassword → ResetPassword
- **Onboarding Stack**: Welcome → ProfileCompletion → SubscriptionChoice → LocationPicker → NodeSelection → FeatureHighlights → OnboardingCarousel (EDU-004)
- **Authenticated Stack**: Home (Tab Navigator) → Detail Screens (modal stack)

**Bottom Tab Navigator** (from HomeTabNavigator.tsx):
- **Active Tabs**: Dashboard, Discover
- **Missing Tabs**: Messages (found screen but not in tabs), Profile (found screen but not in tabs)

**Modal Screens** (presented over tabs):
- ItemDetail
- CreateListing
- EditListing
- TradeInitiation
- ChatScreen
- ProfileScreen
- SettingsScreen
- etc.

### 5.2 Navigation Gaps

- Only 2 bottom tabs active (Dashboard, Discover) - expected 4-5 for marketplace app
- Messages screen exists but not in tab navigator
- Profile screen exists but not in tab navigator
- Inconsistent modal presentation (some screens push, others modal)

### 5.3 Deep Linking Configuration

**Configured Routes** (from linking config):
- Password reset: `p2pkidsmarketplace://reset-password`
- Listing detail: `p2pkidsmarketplace://listing/:listing_id`
- OAuth callback: `p2pkidsmarketplace://oauth-callback` (AUTH-V3-003)
- Notification deep links: Supported (via NotificationDeepLinkData)

**Gaps**:
- No universal links configured (https:// scheme present but domain unclear)
- No share deep links for items
- No referral deep links documented

---

## 6. Technical Constraints & Considerations

### 6.1 Dependencies

**UI Libraries**:
- React Native (no version specified in audit)
- Expo SDK
- React Navigation v6
- @expo/vector-icons (Ionicons)
- ~~NativeBase~~ (DISABLED - runtime conversion error, see App.tsx comment)
- react-native-gesture-handler
- react-native-safe-area-context

**Design System Note**: NativeBase disabled due to iOS runtime error. Custom design system required.

### 6.2 Platform Support

- **iOS**: Simulator testing only (per user preference)
- **Android**: Simulator testing only (per user preference)
- **Expo Go**: Development environment
- **Standalone Builds**: Production (requires native config for deep links)

### 6.3 Testing Infrastructure

**Required Testing Per Flow** (from user requirements):
- Unit tests (__tests__/)
- E2E tests (RUN_SUPABASE_E2E=true npm run test:e2e)
- Maestro UI flows (.maestro/*.yaml)
- Manual testing per flow (documented in *-MANUAL-TESTING-GUIDE.md files)

**Impact on Redesign**:
- All screen changes require updating Maestro flows
- Visual regressions need screenshot comparison
- No visual testing framework currently in place

---

## 7. Redesign Priorities & Recommendations

### 7.1 High-Impact Screens (Priority 1 - Week 1)

**Critical UX Touchpoints** (13 screens):
1. LoginScreen + SignupScreen (FLOW-01) - First impression
2. LandingScreen (FLOW-01) - Brand introduction
3. WelcomeScreen + OnboardingCarousel (FLOW-02, MODULE-18) - User retention
4. DiscoverScreen (FLOW-06) - Core discovery loop
5. ItemDetailScreen (FLOW-06) - Purchase decision point
6. ItemCreateScreen (FLOW-04) - Seller activation
7. TradeInitiationScreen (FLOW-08) - Transaction initiation
8. UserDashboardScreen - Home hub

**Visual Impact**: These screens represent 80% of user interactions

### 7.2 Medium-Impact Screens (Priority 2 - Week 2)

**Supporting Flows** (20 screens):
- Profile management (EditProfileScreen, ProfileScreen, BadgesScreen)
- Subscription flow (SubscriptionChoiceScreen, SubscriptionPaymentScreen)
- Messaging (ConversationsListScreen, ChatScreen)
- Trading completion (TradeTimelineScreen, TradeSuccessScreen)
- Settings & preferences

### 7.3 Low-Impact Screens (Priority 3 - Week 3+)

**Support & Edge Cases** (35 screens):
- Legal screens (ToS, Privacy, Liability)
- Help & education
- Referral dashboard
- Payout settings
- Notification preferences
- etc.

### 7.4 Design System Requirements

**Must-Have Components** (based on screen analysis):
1. **Buttons**: Primary, Secondary, Tertiary, Icon, Social Login (3 providers)
2. **Cards**: Item Card, Trade Card, Recent Trade Card, Profile Card
3. **Inputs**: Text Input, Search Bar, Date Picker, Slider, OTP Input (6-digit)
4. **Modals**: Alert, Confirmation, Phone Verification (2-step), Account Linking, Set Password
5. **Banners**: Info, Warning, Error, Success, Grace Period, Trial Reminder
6. **Navigation**: Bottom Tabs, Header, Back Button
7. **Lists**: Flat List, Section List, Conversation List
8. **Status**: Loading Spinner, Empty State, Error State
9. **Badges**: User Badges (BadgeShowcase), Status Pills
10. **Media**: Image Picker, Photo Grid, Avatar

---

## 8. Action Items for Phase 1

**Deliverable 1: App Overview** (`app-overview.md`)
- Input: This audit (screen count, flow count)
- Input: User requirement (P2P marketplace, "Pass It Up" name)
- Output: App purpose, target users, business model, personas

**Deliverable 2: Design System** (`design-system.md`)
- Input: Samsung Food screenshots (color palette extraction)
- Input: Component inventory (Section 2.2)
- Input: Current theme gaps (Section 4.1)
- Output: Colors, typography, spacing, component anatomy

**Deliverable 3: Screen-to-Flow Mapping** (`screen-flow-mapping-technical-guide.md`)
- Input: Section 3 (flow-to-screen matrix)
- Input: flow-registry.md (1900+ lines)
- Output: Flow → Screens → Components → Interactions

**Deliverable 4: Figma Agent Prompts** (`figma-agent-prompts.md`)
- Input: Design system (Deliverable 2)
- Input: Screen-to-flow mapping (Deliverable 3)
- Input: Priority matrix (Section 7.1-7.3)
- Output: Copy-paste ready prompts for Figma Make (Option C granularity)

**Deliverable 5: Implementation Guide** (`figma-mcp-implementation-guide.md`)
- Input: Figma Professional setup (user has access)
- Input: Testing requirements (Section 6.3)
- Output: MCP setup, hygiene checklist, flow-by-flow process

---

## 9. Final Decisions (User-Approved)

### ✅ **Duplicate Screens Resolution**:
1. **ItemCreateScreen vs CreateListingScreen**: 
   - **Keep**: `ItemCreateScreen.tsx` (photo-first flow for new item creation)
   - **Action**: Remove or deprecate `CreateListingScreen.tsx` in cleanup phase

2. **ConversationsListScreen vs ConversationsScreen**:
   - **Keep**: `ConversationsListScreen.tsx` (active)
   - **Remove**: `ConversationsScreen.tsx` (unused placeholder)

3. **ProfileSetupScreen duplicates**:
   - **Keep Both**: `profile/ProfileSetupScreen.tsx` AND `onboarding/ProfileCompletionScreen.tsx`
   - **Reason**: Different flows - ProfileSetupScreen for post-OTP, ProfileCompletionScreen for onboarding variant

4. **LoginScreen/SignupScreen .old versions**:
   - **Archive**: Move `LoginScreen.old.tsx` and `SignupScreen.old.tsx` to archive folder
   - **Reason**: Archived backups, not active in production

5. **SpWalletScreen duplicates**:
   - **Keep**: `sp/SpWalletScreen.tsx`
   - **Remove**: `profile/SpWalletScreen.tsx`

### ✅ **Bottom Navigation Tabs**:
- **4 Active Tabs**: Dashboard 🏠, Discover 🔍, Messages 💬, Profile 👤
- **5th Tab (Sell ➕)**: Note as option for Figma UX team to decide during design phase
- **Rationale**: Many marketplaces use 5 tabs with center "+" button for quick listing creation

### ✅ **Cart Flow (FLOW-07)**:
- **Status**: **MVP-Critical** - Design all cart screens in redesign
- **Scope**: 
  - Cart List Screen
  - Cart Item Card component
  - Multi-item Checkout Screen
  - Cart Summary/Review Screen
  - Empty Cart State
- **Backend**: Track as separate development task post-design
- **Note**: Standard marketplace feature, required for competitive parity

### ✅ **Budget Allocation**:
- **Total**: $100 for design assets
- **Icon Set**: ~$40-60 (custom icons from IconScout/Noun Project)
- **Social Login Icons**: Free (official brand guidelines)
- **Empty States**: $0-20 (free unDraw set or budget allocation)
- **Illustrations**: $20-40 (onboarding, success moments)

### ✅ **App Name**:
- **Active Name**: "Pass It Up"
- **Status**: Placeholder (domain confirmed available)
- **Usage**: All design documents will use "Pass It Up" throughout
- **Finalization**: To be decided later (not blocking redesign)

### ✅ **Subscription & Swap Points Business Rules**:
**Critical for UX Design** (affects how we display SP earning potential):

**SP Earning Requirement**:
- Users MUST maintain **active subscription** (trial or paid) to earn SP on sales
- **Trial = Active**: Users on 30-day trial CAN earn SP
- **Post-Trial/Grace = Inactive**: Users who let subscription lapse CANNOT earn new SP
- **UX Impact**: Screens showing "Earn X SP" must check subscription status

**SP Spending Rules**:
- Users CAN spend existing SP balance even after subscription ends
- No subscription required to use accumulated SP credits
- **UX Impact**: Wallet/checkout screens show spending capability regardless of subscription status

**SP Spend Cap**:
- **Range**: 30-70% of item price (admin-configurable via `admin_config`)
- **Not Fixed**: Do NOT hardcode 50% in designs - show as variable
- **UX Impact**: Checkout screens must display dynamic SP spend cap based on admin settings

**Design Implications**:
- Dashboard/listing screens: Conditional "Earn SP" messaging (show only if subscription active)
- Subscription upsell: Emphasize SP earning as benefit of maintaining subscription
- Wallet screen: Always show SP balance + spending capability (no subscription gate)
- Checkout: Dynamic SP slider with admin-configured max percentage

---

## Appendix A: Screen File Paths

**Full List** (68 customer screens):

### Auth & Onboarding
```
src/screens/LoginScreen.tsx
src/screens/SignupScreen.tsx
src/screens/auth/LoginScreen.tsx
src/screens/auth/LoginScreen.old.tsx
src/screens/auth/SignupScreen.tsx
src/screens/auth/SignupScreen.old.tsx
src/screens/auth/PhoneVerificationScreen.tsx
src/screens/auth/ForgotPasswordScreen.tsx
src/screens/auth/ResetPasswordScreen.tsx
src/screens/auth/LandingScreen.tsx
src/screens/auth/SuspendedAccountScreen.tsx
src/screens/onboarding/WelcomeScreen.tsx
src/screens/onboarding/OnboardingScreen.tsx
src/screens/onboarding/FeatureHighlightsScreen.tsx
src/screens/onboarding/ProfileCompletionScreen.tsx
src/screens/onboarding/SubscriptionChoiceScreen.tsx
src/screens/onboarding/LocationPickerScreen.tsx
src/screens/onboarding/NodeSelectionScreen.tsx
src/screens/profile/ProfileSetupScreen.tsx (duplicate)
```

### Discovery
```
src/screens/home/DiscoverScreen.tsx
src/screens/home/CategoryBrowseScreen.tsx
src/screens/home/ItemDetailScreen.tsx
```

### Listings
```
src/screens/ItemCreateScreen.tsx
src/screens/listing/CreateListingScreen.tsx
src/screens/BulkListingCreateScreen.tsx
src/screens/listing/EditListingScreen.tsx
src/screens/listing/MyListingsScreen.tsx
src/screens/listing/ListingSafetyReviewScreen.tsx
```

### Trading
```
src/screens/trade/TradeInitiationScreen.tsx
src/screens/trade/TradeDetailScreen.tsx
src/screens/trade/TradeListScreen.tsx
src/screens/trade/TradeTimelineScreen.tsx
src/screens/trade/TradeSuccessScreen.tsx
src/screens/trade/ActiveTradesScreen.tsx
src/screens/review/SubmitReviewScreen.tsx
```

### Messaging
```
src/screens/messaging/ConversationsListScreen.tsx
src/screens/messaging/ConversationsScreen.tsx
src/screens/messaging/ChatScreen.tsx
```

### Profile & Settings
```
src/screens/profile/ProfileScreen.tsx
src/screens/profile/EditProfileScreen.tsx
src/screens/profile/BadgesScreen.tsx
src/screens/profile/LeaderboardScreen.tsx
src/screens/profile/IDVerificationUploadScreen.tsx
src/screens/profile/LinkedAccountsScreen.tsx
src/screens/profile/SettingsScreen.tsx
src/screens/profile/NotificationPreferencesScreen.tsx
src/screens/profile/TermsOfServiceScreen.tsx
src/screens/profile/PrivacyPolicyScreen.tsx
src/screens/profile/TransactionHistoryScreen.tsx
src/screens/profile/SpWalletScreen.tsx
src/screens/sp/SpWalletScreen.tsx (duplicate)
```

### Subscriptions
```
src/screens/subscription/SubscriptionChoiceScreen.tsx
src/screens/subscription/SubscriptionPaymentScreen.tsx
src/screens/subscription/SubscriptionStatusScreen.tsx
src/screens/subscription/SubscriptionSuccessScreen.tsx
src/screens/subscription/ContinueKidsClubScreen.tsx
src/screens/subscription/ManageKidsClubScreen.tsx
src/screens/subscription/KidsClubOverviewScreen.tsx
src/screens/subscription/BillingHistoryScreen.tsx
```

### Seller
```
src/screens/seller/PayoutSettingsScreen.tsx
src/screens/seller/SellerEarningsScreen.tsx
```

### Dashboard
```
src/screens/dashboard/UserDashboardScreen.tsx
src/screens/dashboard/RecentTradeCard.tsx
```

### Misc
```
src/screens/help/HelpScreen.tsx
src/screens/notifications/NotificationCenterScreen.tsx
src/screens/ReferralDashboardScreen.tsx
src/screens/UnsubscribeScreen.tsx
src/screens/settings/LiabilityDisclaimerScreen.tsx
```

---

**End of Phase 0 Audit**  
**Next Step**: User review + proceed to Phase 1 (Document Creation)
