# Screen-to-Flow Mapping: Pass It Up
**Technical Reference for UX Redesign**  
**Date**: May 4, 2026  
**Version**: 1.0  
**Purpose**: Map all customer-facing screens to flows for Figma design implementation

---

## 1. Overview

This document maps all 68 customer-facing screens to their corresponding flows from `flow-registry.md`. Each flow section includes:
- **Screens**: All screens participating in the flow
- **Components**: Key reusable components used
- **Interactions**: User actions, navigation, data inputs/outputs
- **Design Priority**: Based on user impact and MVP criticality
- **Missing Elements**: Gaps identified in Phase 0 audit

### Flow Priority Legend
- **P0 (Critical)**: Core user experience, MVP-blocking flows
- **P1 (High)**: Important but not blocking, high user impact
- **P2 (Medium)**: Supporting features, moderate user impact
- **P3 (Low)**: Nice-to-have, low user impact

---

## 2. Authentication & Onboarding Flows

### FLOW-01: Auth – Signup/Login/Logout/Session Restore
**Priority**: P0 (Critical) — First user touchpoint

**Screens** (7 total):
1. `src/screens/auth/LandingScreen.tsx`
2. `src/screens/auth/LoginScreen.tsx`
3. `src/screens/auth/SignupScreen.tsx`
4. `src/screens/auth/PhoneVerificationScreen.tsx`
5. `src/screens/auth/ForgotPasswordScreen.tsx`
6. `src/screens/auth/ResetPasswordScreen.tsx`
7. `src/screens/auth/SuspendedAccountScreen.tsx`

**Key Components**:
- `PhoneVerificationModal.tsx` (components/auth/) — 2-step phone verification (SMS OTP)
- `SocialLoginButton.tsx` (components/auth/) — Google, Facebook, Apple sign-in
- `AccountLinkingPrompt.tsx` (components/auth/) — Link social accounts to existing account
- `SetPasswordModal.tsx` (components/auth/) — Set password after social login

**User Flow**:
```
Landing → [Sign Up / Log In]
  ├─ Email/Password Signup → Phone Verification (6-digit OTP) → Profile Setup
  ├─ Social Login (Google/Facebook/Apple) → Phone Verification → Profile Setup
  ├─ Email/Password Login → Dashboard
  ├─ Forgot Password → Email → Reset Password → Login
  └─ Suspended Account → Contact Support (read-only)
```

**Inputs**:
- Email (text input, validation)
- Password (secure input, min 8 chars, validation)
- Phone number (E.164 format, +1 country code)
- OTP code (6-digit numeric input)

**Outputs**:
- Auth session token (Supabase JWT)
- User profile ID
- Phone verification status
- Navigation to onboarding or dashboard

**Design Requirements**:
- **Landing**: Hero section, value prop, social proof, CTA buttons
- **Login/Signup**: Clean forms, social login buttons (3 providers), "or" divider
- **Phone Verification**: OTP input (6 boxes), resend code, countdown timer
- **Password Reset**: Email input, success confirmation, check email prompt
- **Suspended**: Clear messaging, support contact, no primary actions

**Missing Elements**:
- Social login buttons use text labels (need official brand icons from guidelines)
- No biometric login (Face ID, Touch ID) — future enhancement

---

### FLOW-02: Profiles & Onboarding
**Priority**: P0 (Critical) — User retention driver

**Screens** (5 total):
1. `src/screens/onboarding/WelcomeScreen.tsx`
2. `src/screens/onboarding/ProfileCompletionScreen.tsx`
3. `src/screens/onboarding/FeatureHighlightsScreen.tsx`
4. `src/screens/onboarding/OnboardingScreen.tsx` (trading education carousel)
5. `src/screens/profile/ProfileSetupScreen.tsx` (post-OTP variant)

**Key Components**:
- `DateOfBirthPicker.tsx` (components/) — Age verification (18+)
- Profile avatar picker (built into ProfileCompletionScreen)
- Feature highlights carousel (built into FeatureHighlightsScreen)

**User Flow**:
```
Welcome → Profile Completion → Feature Highlights → Onboarding Carousel → Location Picker → Node Selection → Subscription Choice → Dashboard
```

**Inputs**:
- Display name (text input, required)
- Date of birth (date picker, 18+ validation)
- Avatar photo (camera/gallery picker, optional)
- Location preferences (see FLOW-03)

**Outputs**:
- User profile created/updated
- Onboarding completion flag
- Navigation to dashboard or subscription choice

**Design Requirements**:
- **Welcome**: Branded hero, tagline, "Get Started" CTA
- **Profile Completion**: Avatar upload (circle crop), display name, DOB picker
- **Feature Highlights**: 3-4 slides with illustrations (photo-first listing, SP rewards, local pickup, safety features)
- **Onboarding Carousel**: Trading education (MODULE-18 EDU-004), swipeable cards, progress dots

**Missing Elements**:
- Onboarding illustrations need design ($20-40 from budget)
- No skip option (intentional — profile completion required)

---

### FLOW-03: Node/ZIP Gating + Waitlist
**Priority**: P1 (High) — Location-based community access

**Screens** (2 total):
1. `src/screens/onboarding/LocationPickerScreen.tsx`
2. `src/screens/onboarding/NodeSelectionScreen.tsx`

**Key Components**:
- `RadiusSlider.tsx` (components/) — Search radius selector (5-50 miles)
- ZIP autocomplete (built into LocationPickerScreen)

**User Flow**:
```
Location Picker (enter ZIP) → Node Selection (choose community) → [Onboarding continues]
```

**Inputs**:
- ZIP code (5-digit input, validation)
- Search radius (slider, 5-50 miles)
- Node selection (if multiple nodes available)

**Outputs**:
- User's home ZIP
- Selected node ID
- Search radius preference

**Design Requirements**:
- **Location Picker**: ZIP input, radius slider, map preview (optional)
- **Node Selection**: List of available nodes (if multiple in radius), node info cards

**Missing Elements**:
- No map visualization (text-based ZIP entry only)
- Waitlist flow not implemented (future feature if node at capacity)

---

## 3. Discovery & Browse Flows

### FLOW-06: Discovery – Feed/Search/Filters/Favorites
**Priority**: P0 (Critical) — Core discovery loop

**Screens** (3 total):
1. `src/screens/home/DiscoverScreen.tsx` (unified search + browse)
2. `src/screens/home/CategoryBrowseScreen.tsx`
3. `src/screens/home/ItemDetailScreen.tsx`

**Key Components**:
- `SearchFilterModal.tsx` (components/molecules/) — Bottom sheet with 8 filter sections
- `SearchBar.tsx` (components/shared/) — Search input with autocomplete
- `ItemCard.tsx` (components/discovery/) — Grid card for item listings
- `SearchResultCard.tsx` (components/discovery/) — Search result row
- `ActiveFilterChips.tsx` (components/discovery/) — Filter chips with tap-to-remove
- `SortDropdown.tsx` (components/discovery/) — Sort options (relevant, newest, price low/high)
- `FavoriteButton.tsx` (components/shared/) — Heart icon toggle

**User Flow**:
```
Discover Tab → [Search / Browse Categories / Filters]
  ├─ Search: Type query → Autocomplete suggestions → Results grid → Item Detail
  ├─ Browse: Select category → Filtered grid → Item Detail
  ├─ Filter: Tap filter icon → Modal (8 sections) → Apply → Filtered results
  ├─ Sort: Tap sort dropdown → Select option → Re-sorted results
  └─ Favorite: Tap heart → Item saved to favorites
```

**Search Filters** (8 sections from DISCOVERY-V3-006):
1. **Category**: Multi-select category chips
2. **Condition**: New, Like New, Good, Fair (chips)
3. **Price Range**: Min/max inputs + slider
4. **Size**: Size filters (category-dependent)
5. **Brand**: Autocomplete search + popular brands
6. **Age Range**: Age suitability (category-dependent)
7. **Location**: Distance radius slider
8. **Keywords**: Free-text keyword search

**Inputs**:
- Search query (text input, 200ms debounce)
- Filter selections (category, condition, price, size, brand, age, location, keywords)
- Sort selection (relevant, newest, price_asc, price_desc)

**Outputs**:
- Paginated search results (infinite scroll)
- Filter state persistence
- Search history (auto-saved)
- Navigation to item detail

**Design Requirements**:
- **DiscoverScreen**: Search bar (pill shape), filter button, sort dropdown, item grid (2 columns), infinite scroll
- **SearchFilterModal**: Bottom sheet, 8 sections, clear all, apply button, filter count badge
- **ItemCard**: Image (1:1), title (2 lines max), price + SP badge, location, favorite icon
- **CategoryBrowseScreen**: Category header, filtered grid, breadcrumb navigation
- **ItemDetailScreen**: Image carousel, title, price, SP earn badge, seller info, description, Buy Now CTA

**Missing Elements**:
- Active filter chips display (DISCOVERY-V3-007 in progress)
- Saved searches feature not implemented

---

## 4. Listing Management Flows

### FLOW-04: Listings – Create/Edit/Delete/Expire/Soft Delete
**Priority**: P0 (Critical) — Seller activation

**Screens** (5 total):
1. `src/screens/ItemCreateScreen.tsx` (primary photo-first flow)
2. `src/screens/listing/BulkListingCreateScreen.tsx`
3. `src/screens/listing/EditListingScreen.tsx`
4. `src/screens/listing/MyListingsScreen.tsx`
5. `src/screens/listing/ListingSafetyReviewScreen.tsx`

**Key Components**:
- `PhotoPicker.tsx` (components/listing/) — Camera/gallery selector, image crop
- `CategoryPicker.tsx` (components/listing/) — Hierarchical category selector
- `ConditionPicker.tsx` (components/listing/) — Condition chips (New, Like New, Good, Fair)
- `PriceSuggestion.tsx` (components/listing/) — AI price recommendation (future)
- `ListingCard.tsx` (components/listing/) — My listings card (thumbnail, title, status, actions)

**User Flow (Create)**:
```
Create Listing → Photo Upload (1-6 images) → Auto-fill Category + Details → Set Price → Review → Publish
  ├─ Photo first: Tap camera/gallery → Select images → Crop 1:1 → Auto-detect category (future)
  ├─ Details: Title (auto-suggested), description, condition, size, brand
  ├─ Price: Amount + SP earn preview
  └─ Safety: CPSC recall check + AI moderation (background)
```

**User Flow (Bulk Create)**:
```
Bulk Listing → Upload multiple photos → Auto-group by item → Batch edit → Publish all
```

**Inputs**:
- Item photos (1-6 images, 1:1 crop, max 5MB each)
- Category (hierarchical picker, required)
- Title (text input, auto-suggested from photo/category)
- Description (textarea, optional)
- Condition (chips: New, Like New, Good, Fair)
- Size (category-dependent, dropdown)
- Brand (autocomplete, optional)
- Price (numeric input, min $1)

**Outputs**:
- Listing created (status: active/pending_review)
- CPSC recall check result
- AI moderation result (async)
- Navigation to My Listings or Dashboard

**Design Requirements**:
- **ItemCreateScreen**: Photo-first (large upload area), progressive disclosure (category → details → price), progress indicator, SP earn preview
- **BulkListingCreateScreen**: Multi-photo grid, batch editing, duplicate detection
- **EditListingScreen**: Pre-filled form, "Save Changes" CTA
- **MyListingsScreen**: List view, status badges (active, sold, expired), edit/delete actions
- **ListingSafetyReviewScreen**: Recall alert banner, item details, "Remove Listing" CTA

**Missing Elements**:
- AI price suggestion not implemented (manual input only)
- Duplicate listing detection not implemented

---

### FLOW-05: Media Upload (Storage) – Listing Photos
**Priority**: P0 (Critical) — Photo-first marketplace

**Screens**:
- Integrated into `ItemCreateScreen.tsx`, `EditListingScreen.tsx`, `BulkListingCreateScreen.tsx`

**Key Components**:
- `ImagePicker.tsx` (Expo ImagePicker) — Camera/gallery access
- `ImageCrop.tsx` (custom) — 1:1 aspect ratio crop
- `UploadProgress.tsx` (components/listing/) — Upload progress bar

**User Flow**:
```
Tap "Add Photo" → [Camera / Gallery] → Select image → Crop 1:1 → Upload → Thumbnail preview
  ├─ Multiple uploads: Repeat for up to 6 images
  └─ Reorder: Drag to rearrange image order
```

**Inputs**:
- Image file (JPEG/PNG, max 5MB)
- Crop coordinates (1:1 aspect ratio)

**Outputs**:
- Signed URL for uploaded image
- Image metadata (size, dimensions, upload timestamp)
- AI moderation result (async, fire-and-forget)

**Design Requirements**:
- Photo grid (2x3 max), drag-to-reorder, delete button per image
- Upload progress indicator
- Image quality compression (auto-optimize for mobile)

**Missing Elements**:
- No bulk upload progress tracking (uploads sequentially)
- No image filters/editing (upload raw image only)

---

## 5. Trading & Checkout Flows

### FLOW-07: Cart & Bundling
**Priority**: P0 (Critical) — MVP-blocking, multi-item checkout

**Status**: 🚧 **NOT IMPLEMENTED** — Design required

**Screens** (to be designed):
1. `CartScreen.tsx` (new) — Cart list view
2. `CartCheckoutScreen.tsx` (new) — Multi-item checkout

**Key Components** (to be designed):
- `CartItemCard.tsx` — Item thumbnail, title, price, remove button
- `CartSummary.tsx` — Subtotal, fees, SP credits, total
- `MultiItemCheckout.tsx` — Payment method, delivery notes, confirm CTA

**User Flow** (proposed):
```
Item Detail → Add to Cart → [Continue Shopping / View Cart]
  ├─ View Cart → Cart list → Remove items / Update quantities → Checkout
  ├─ Checkout → Review items → Payment method → Apply SP → Confirm & Pay
  └─ Success → Order confirmation → Track trades separately
```

**Inputs**:
- Cart items (array of listing IDs)
- Payment method (card details)
- SP allocation (per-item or total)
- Delivery notes (optional)

**Outputs**:
- Multiple trade records (one per item)
- Payment confirmation
- Navigation to active trades list

**Design Requirements**:
- **CartScreen**: List of items, subtotal, "Checkout" CTA, empty state ("Your cart is empty")
- **CartCheckoutScreen**: Item summary cards, payment section, SP slider (per-item or total), disclaimer modal, "Confirm & Pay" CTA
- **Empty State**: Illustration, "Start browsing" CTA

**Missing Elements**:
- Full cart implementation (backend + frontend)
- Multi-item SP allocation logic
- Bundled shipping/pickup coordination

---

### FLOW-08: Trade Flow – Checkout + Transaction State Machine
**Priority**: P0 (Critical) — Transaction completion

**Screens** (6 total):
1. `src/screens/trade/TradeInitiationScreen.tsx`
2. `src/screens/trade/TradeDetailScreen.tsx`
3. `src/screens/trade/TradeListScreen.tsx`
4. `src/screens/trade/TradeTimelineScreen.tsx`
5. `src/screens/trade/TradeSuccessScreen.tsx`
6. `src/screens/trade/ActiveTradesScreen.tsx`

**Key Components**:
- `DisclaimerModal.tsx` (components/) — Terms acceptance modal
- `PaymentMethodCard.tsx` (components/trade/) — Stripe card input
- `TradeSummary.tsx` (components/trade/) — Price breakdown (item + fees + SP)
- `TradeStatusBadge.tsx` (components/trade/) — Status pill (pending, in_progress, completed, cancelled)
- `TradeTimelineStep.tsx` (components/trade/) — Timeline progress indicator

**User Flow**:
```
Item Detail → Buy Now → Trade Initiation (payment) → Trade Confirmed → Track Progress → Complete Trade
  ├─ Initiation: Review item → Enter payment method → Apply SP (up to 30-70%) → Accept disclaimer → Confirm & Pay
  ├─ In Progress: Seller ships/arranges pickup → Buyer receives item → Both mark complete
  ├─ Timeline: Created → Paid → In Progress → Seller Marked Complete → Buyer Marked Complete → Completed
  └─ Success: Celebration screen → Rate seller → View receipt
```

**Trade States** (state machine):
1. `pending` — Payment processing
2. `in_progress` — Payment confirmed, awaiting completion
3. `seller_marked_completed` — Seller marked complete, awaiting buyer confirmation
4. `completed` — Both parties confirmed, funds/SP released
5. `cancelled` — Trade cancelled (admin/refund)

**Inputs**:
- Payment method (Stripe CardField on Android, CardForm on iOS)
- SP allocation (slider, 0% to admin-configured max 30-70%)
- Disclaimer acceptance (checkbox)
- Completion confirmation (buyer + seller both mark complete)

**Outputs**:
- Trade record created
- Payment processed (Stripe charge)
- SP deducted from buyer wallet (pending status)
- SP credited to seller wallet (pending → available after buyer confirms)
- Seller earnings increased
- Item status updated to `sold`

**Design Requirements**:
- **TradeInitiationScreen**: Item summary card, payment section (card input), SP slider with preview, fee breakdown, total, disclaimer modal, "Confirm & Pay" CTA
- **TradeDetailScreen**: Item info, seller info, trade ID, status badge, timeline link, message seller, cancel option (if pending)
- **TradeTimelineScreen**: Vertical timeline (5 steps), current step highlighted, timestamps, next action prompt
- **TradeSuccessScreen**: Celebration graphic (confetti/checkmark), trade summary, "Rate Seller" CTA, "View Receipt" button
- **ActiveTradesScreen**: List of active trades (status badges), filter by status, tap to view detail

**Missing Elements**:
- Dispute resolution flow not implemented (future)
- Automatic completion after 7 days not visualized in UI

---

### FLOW-09: Fees & Pricing Engine
**Priority**: P1 (High) — Transparent pricing

**Screens**:
- Integrated into `TradeInitiationScreen.tsx`, `ItemCreateScreen.tsx`

**Key Components**:
- `FeeSummary.tsx` (components/trade/) — Fee breakdown table
- `SPPreview.tsx` (components/shared/) — SP earn/spend preview

**User Flow**:
```
[Anywhere pricing is shown] → Display: Item Price + Buyer Fee + SP Discount = Total
  ├─ Seller View: Item price → Estimated earnings (price - seller fee) + SP earned
  └─ Buyer View: Item price + buyer fee - SP credits = Total due
```

**Fee Structure**:
- **Buyer Fee**: 5-8% of item price (tier-dependent, admin-configurable)
- **Seller Fee**: 0% (no seller fee currently)
- **SP Spend Cap**: 30-70% of item price (admin-configurable)

**Design Requirements**:
- Fee breakdown table (item price, buyer fee, SP credits, total)
- Clear labels ("Platform Fee", "Kids Club Member Fee: 5%")
- SP earn preview on listing creation ("Earn ~250 SP when this sells")
- SP spend slider on checkout (dynamic max based on admin config)

---

## 6. Swap Points (SP) Flows

### FLOW-10: Swap Points Wallet – Read + Ledger Integrity
**Priority**: P1 (High) — Gamification transparency

**Screens** (2 total):
1. `src/screens/sp/SpWalletScreen.tsx`
2. `src/screens/profile/TransactionHistoryScreen.tsx`

**Key Components**:
- `WalletBalance.tsx` (components/sp/) — Available + pending balance display
- `TransactionRow.tsx` (components/sp/) — Ledger entry row (icon, type, amount, date)
- `SPBadge.tsx` (components/shared/) — SP coin icon + amount

**User Flow**:
```
Profile → SP Wallet → View Balance → [Tap Transaction History]
  ├─ Balance: Available SP (green) + Pending SP (yellow)
  ├─ History: Chronological list (earned, spent, pending, released)
  └─ Filter: All / Earned / Spent
```

**Inputs**:
- None (read-only view)

**Outputs**:
- SP balance display
- Transaction history list

**Design Requirements**:
- **SpWalletScreen**: Hero balance card (available + pending), SP coin graphic, "How SP Works" explainer, transaction history preview (last 5), "View All" link
- **TransactionHistoryScreen**: Section list (grouped by date), transaction rows (icon, type, amount, date), filter tabs

**Transaction Types**:
- `earned_sale` — Earned SP from selling item (green, +)
- `spent_purchase` — Spent SP on purchase (orange, -)
- `pending_sale` — Pending SP from in-progress trade (yellow, +)
- `released` — Pending SP released to available (green, +)
- `bonus_starter_pack` — First-listing bonus (green, +)

---

### FLOW-11: Swap Points – Earn/Spend/Cap + Pending→Release
**Priority**: P1 (High) — Subscription benefit

**Screens**:
- Integrated into `ItemCreateScreen.tsx` (earn preview), `TradeInitiationScreen.tsx` (spend slider)

**Key Components**:
- `SPEarnBadge.tsx` (components/shared/) — "Earn 250 SP" badge on item cards
- `SPSlider.tsx` (components/trade/) — Spend slider on checkout (0% to admin-configured max)

**User Flow**:
```
[Seller] Create listing → SP earn preview → Item sells → SP pending → Buyer confirms → SP released to available
[Buyer] Checkout → SP slider → Apply SP (up to 30-70%) → Remaining balance paid by card
```

**Business Rules** (from app-overview.md):
- **Earning**: Requires active subscription (trial or paid) — no earning if subscription lapsed
- **Spending**: No subscription required — can spend existing balance anytime
- **Spend Cap**: 30-70% of item price (admin-configurable via `admin_config`)
- **Pending Release**: SP earned from sale remains pending until buyer marks trade complete

**Design Requirements**:
- **Earn Preview**: Badge on item cards ("Earn up to 250 SP"), conditional on subscription status
- **Spend Slider**: Dynamic max (based on admin config), real-time total update, "You'll save $X" message
- **Subscription Upsell**: If user tries to create listing without subscription, show "Subscribe to earn SP" banner

**Missing Elements**:
- SP spend allocation across multiple items in cart (requires FLOW-07 cart implementation)

---

## 7. Subscription Flows

### FLOW-12: Subscriptions – Purchase/Cancel/Grace Period
**Priority**: P1 (High) — Primary revenue driver

**Screens** (8 total):
1. `src/screens/subscription/SubscriptionChoiceScreen.tsx`
2. `src/screens/subscription/SubscriptionPaymentScreen.tsx`
3. `src/screens/subscription/SubscriptionStatusScreen.tsx`
4. `src/screens/subscription/SubscriptionSuccessScreen.tsx`
5. `src/screens/subscription/ContinueKidsClubScreen.tsx`
6. `src/screens/subscription/ManageKidsClubScreen.tsx`
7. `src/screens/subscription/KidsClubOverviewScreen.tsx`
8. `src/screens/subscription/BillingHistoryScreen.tsx`

**Key Components**:
- `SubscriptionTierCard.tsx` (components/subscription/) — Tier comparison card (Free, Kids Club)
- `TrialReminderBanner.tsx` (components/) — Trial countdown banner
- `GracePeriodBanner.tsx` (components/) — Post-trial grace period banner
- `BillingHistoryRow.tsx` (components/subscription/) — Invoice row

**User Flow**:
```
[Onboarding or Profile] → Subscription Choice → Select Tier → Payment → Success → Dashboard
  ├─ Free Trial: Start 30-day trial → Access full features + SP earning → Trial reminder banners (7d, 3d, 1d before expiration)
  ├─ Kids Club: Enter payment method → Subscribe ($9.99/month or $99/year) → Success celebration
  ├─ Grace Period: Trial ends → 90-day grace (access continues, no SP earning, gentle nudges) → Upgrade prompt
  ├─ Manage: Profile → Manage Subscription → [Cancel / Update Payment / View Billing History]
  └─ Renewal: Auto-renew → Success notification → Next billing date shown
```

**Subscription Tiers**:
1. **Free Trial** (30 days):
   - Full access + SP earning enabled
   - Countdown banner at 7d, 3d, 1d remaining
2. **Kids Club** ($9.99/month or $99/year):
   - Lower fees (5% vs 8%)
   - SP earning enabled
   - Bulk tools, priority visibility
3. **Grace Period** (90 days post-trial):
   - Full access continues
   - SP earning disabled
   - Gentle upgrade nudges

**Inputs**:
- Payment method (Stripe card input)
- Billing frequency (monthly/annual toggle)

**Outputs**:
- Subscription created (Stripe)
- User tier updated
- Trial start/end dates recorded
- Navigation to dashboard or success screen

**Design Requirements**:
- **SubscriptionChoiceScreen**: Side-by-side tier cards, feature comparison table, "Start Free Trial" vs "Subscribe Now" CTAs
- **SubscriptionPaymentScreen**: Payment method section, billing frequency toggle, price summary, "Subscribe" CTA
- **SubscriptionSuccessScreen**: Celebration graphic, benefits summary, "Get Started" CTA
- **TrialReminderBanner**: Countdown (X days left), "Subscribe Now" CTA, dismissible
- **GracePeriodBanner**: "Your trial ended X days ago", "Subscribe to keep earning SP", "Subscribe" CTA
- **ManageKidsClubScreen**: Current plan, next billing date, "Cancel Subscription" (with warning), "Update Payment Method"
- **BillingHistoryScreen**: Invoice list (date, amount, status, download receipt)

**Missing Elements**:
- Promo codes not implemented
- Annual plan discount visualization (should show "Save 17% with annual")

---

## 8. Messaging Flows

### FLOW-14: Messaging (Realtime)
**Priority**: P1 (High) — Buyer/seller communication

**Screens** (2 total):
1. `src/screens/messaging/ConversationsListScreen.tsx`
2. `src/screens/messaging/ChatScreen.tsx`

**Key Components**:
- `ConversationRow.tsx` (components/messaging/) — Conversation preview (avatar, name, last message, timestamp, unread badge)
- `MessageBubble.tsx` (components/messaging/) — Chat bubble (sender vs receiver style)
- `MessageInput.tsx` (components/messaging/) — Text input + send button

**User Flow**:
```
Messages Tab → Conversations List → Tap Conversation → Chat Screen → Send Message
  ├─ List: Shows all conversations (sorted by last message timestamp), unread badge
  ├─ Chat: Message thread (scrollable), real-time updates, text input, send button
  └─ New Message: From item detail → "Message Seller" → Opens chat
```

**Inputs**:
- Message text (text input, max 500 chars)

**Outputs**:
- Message sent (Supabase Realtime)
- Read receipts (future)
- Push notification to recipient (if offline)

**Design Requirements**:
- **ConversationsListScreen**: Conversation rows (avatar, name, preview, timestamp, unread badge), swipe-to-delete (optional)
- **ChatScreen**: Header (other user avatar + name), message bubbles (sender = right/primary color, receiver = left/neutral), timestamp (bottom of bubble), input field (bottom, sticky), send button
- **Empty State**: "No messages yet" illustration, "Start browsing to connect with sellers"

**Missing Elements**:
- Read receipts not visualized (backend supports, UI missing)
- Typing indicators not implemented
- Image/photo sharing not supported (text-only)

---

## 9. Profile & Settings Flows

### FLOW-02: Profiles (View/Edit)
**Priority**: P1 (High) — User identity

**Screens** (3 total):
1. `src/screens/profile/ProfileScreen.tsx`
2. `src/screens/profile/EditProfileScreen.tsx`
3. `src/screens/profile/BadgesScreen.tsx`

**Key Components**:
- `ProfileHeader.tsx` (components/profile/) — Avatar, name, verified badge, stats
- `BadgeShowcase.tsx` (components/) — Badge grid display
- `ProfileStats.tsx` (components/profile/) — Items sold, rating, join date

**User Flow**:
```
Profile Tab → View Profile → [Edit / View Badges / Settings]
  ├─ Edit: Tap "Edit Profile" → Update avatar/name → Save
  ├─ Badges: Tap "View Badges" → Badge showcase → Badge detail modal
  └─ Settings: Tap gear icon → Settings screen
```

**Inputs** (Edit Profile):
- Avatar photo (camera/gallery)
- Display name (text input)
- Bio (textarea, optional, max 200 chars)

**Outputs**:
- Profile updated
- Navigation back to profile view

**Design Requirements**:
- **ProfileScreen**: Header (avatar, name, verified badge, edit button), stats row (items sold, rating, join date), badges preview (3 badges + "View All"), recent listings preview
- **EditProfileScreen**: Avatar upload (circle crop), display name input, bio textarea, "Save Changes" CTA
- **BadgesScreen**: Badge grid (earned badges highlighted, locked badges grayed out), tap badge for detail modal (badge name, description, unlock criteria)

---

### FLOW-21: ID Verification
**Priority**: P2 (Medium) — Trust & safety

**Screens** (1 total):
1. `src/screens/profile/IDVerificationUploadScreen.tsx`

**Key Components**:
- `IDDocumentPicker.tsx` (components/profile/) — Document upload (driver's license, passport)

**User Flow**:
```
Profile → Tap "Get Verified" → Upload ID → Awaiting Review → Verified Badge
```

**Inputs**:
- ID document photo (front + back)
- Document type (dropdown: driver's license, passport, state ID)

**Outputs**:
- Verification request submitted
- Admin review (manual, out of scope for redesign)
- Verified badge on profile (after approval)

**Design Requirements**:
- **IDVerificationUploadScreen**: Document type selector, photo upload (2 images: front + back), privacy disclaimer, "Submit for Review" CTA

---

### FLOW-13: Referrals – Code Generation + Apply On Signup
**Priority**: P2 (Medium) — Growth mechanic

**Screens** (1 total):
1. `src/screens/ReferralDashboardScreen.tsx`

**Key Components**:
- `ReferralCodeCard.tsx` (components/) — User's referral code + share button
- `ReferralStatsCard.tsx` (components/) — Referrals count, rewards earned

**User Flow**:
```
Profile → Referrals → View Code → Share → Friend Signs Up → Earn Reward
```

**Inputs**:
- None (code auto-generated on signup)

**Outputs**:
- Referral code displayed
- Share sheet (copy link, SMS, social)

**Design Requirements**:
- **ReferralDashboardScreen**: Hero card (user's referral code, "Share Code" CTA), stats (total referrals, rewards earned), referral history list

**Missing Elements**:
- Referral reward details not specified (future: SP bonus, fee discount, etc.)

---

## 10. Seller & Payout Flows

### FLOW-22: Seller Payouts
**Priority**: P2 (Medium) — Seller earnings withdrawal

**Screens** (2 total):
1. `src/screens/seller/PayoutSettingsScreen.tsx`
2. `src/screens/seller/SellerEarningsScreen.tsx`

**Key Components**:
- `PayoutMethodCard.tsx` (components/seller/) — Payout method (Stripe Connect, PayPal, Venmo)
- `EarningsSummary.tsx` (components/seller/) — Available, pending, lifetime earnings

**User Flow**:
```
Profile → Seller Earnings → [Add Payout Method / Withdraw Funds]
  ├─ Payout Settings: Add Stripe Connect → Onboard with Stripe → Verified
  ├─ Payout Settings: Add PayPal/Venmo → Enter email → Save
  ├─ Withdraw: Select amount → Choose payout method → Confirm → Processing → Completed
  └─ Earnings: View available balance, pending (in-progress trades), lifetime earnings
```

**Inputs**:
- Payout method selection (Stripe, PayPal, Venmo)
- PayPal/Venmo email (text input, email validation)
- Withdrawal amount (numeric input, min $1, max available balance)

**Outputs**:
- Payout method saved
- Payout request submitted
- Balance updated

**Design Requirements**:
- **SellerEarningsScreen**: Earnings summary cards (available, pending, lifetime), withdraw button, transaction history, payout method link
- **PayoutSettingsScreen**: Payout method cards (Stripe, PayPal, Venmo), "Add Method" CTAs, default method toggle

**Missing Elements**:
- No charts/visualizations for earnings over time (text-based only)

---

## 11. Notifications & Education Flows

### FLOW-17: Notifications
**Priority**: P2 (Medium) — User engagement

**Screens** (2 total):
1. `src/screens/notifications/NotificationCenterScreen.tsx`
2. `src/screens/profile/NotificationPreferencesScreen.tsx`

**Key Components**:
- `NotificationRow.tsx` (components/notifications/) — Notification card (icon, title, message, timestamp, unread badge)
- `NotificationPreferenceToggle.tsx` (components/notifications/) — Toggle switches (push, in-app, email)

**User Flow**:
```
Bell Icon (header) → Notification Center → Tap Notification → Deep Link to Destination
  ├─ Types: Trade updates, subscription reminders, payment failures, messages
  ├─ Preferences: Settings → Notification Preferences → Toggle categories (push, in-app, email)
  └─ Critical Notifications: Payment failures bypass all preferences (always sent)
```

**Notification Types**:
- **Trade Updates**: Trade confirmed, seller marked complete, buyer marked complete, trade completed
- **Subscription**: Trial reminders (7d, 3d, 1d), renewal success, payment failure, cancellation confirmed
- **Messages**: New message from buyer/seller
- **Safety**: CPSC recall match, AI moderation flag

**Design Requirements**:
- **NotificationCenterScreen**: List of notifications (grouped by date), unread badge, mark all as read, tap to navigate
- **NotificationPreferencesScreen**: Category toggles (Trades, Subscriptions, Messages, Safety), channel toggles per category (push, in-app, email), critical notification disclaimer

---

### FLOW-19: Trading Education – Onboarding, Help Content
**Priority**: P3 (Low) — Support content

**Screens** (2 total):
1. `src/screens/onboarding/OnboardingScreen.tsx` (trading education carousel)
2. `src/screens/help/HelpScreen.tsx`

**Key Components**:
- `EducationCard.tsx` (components/education/) — Carousel card (illustration, title, description)
- `HelpArticle.tsx` (components/help/) — FAQ accordion

**User Flow**:
```
Onboarding → Trading Education Carousel (4 slides) → Swipe through → Continue
Help → Browse FAQs → Tap question → Expand answer
```

**Design Requirements**:
- **OnboardingScreen**: Carousel (4 slides: How to sell, How to buy, SP rewards, Safety features), progress dots, "Next" / "Get Started" CTA
- **HelpScreen**: FAQ list (accordion), search bar, contact support link

---

## 12. Legal & Settings Flows

### FLOW-02: Legal Screens
**Priority**: P3 (Low) — Required but low interaction

**Screens** (3 total):
1. `src/screens/profile/TermsOfServiceScreen.tsx`
2. `src/screens/profile/PrivacyPolicyScreen.tsx`
3. `src/screens/settings/LiabilityDisclaimerScreen.tsx`

**User Flow**:
```
Settings → [Terms / Privacy / Disclaimer] → Read → Back
```

**Design Requirements**:
- Plain text/markdown rendering
- Scrollable content
- Version number + last updated date

---

## 13. Dashboard & Home Flows

### Dashboard Aggregation
**Priority**: P0 (Critical) — Home hub

**Screens** (1 total):
1. `src/screens/dashboard/UserDashboardScreen.tsx`

**Key Components**:
- `RecentTradeCard.tsx` (components/dashboard/) — Recent trade summary
- `ActiveListingsWidget.tsx` (components/dashboard/) — Active listings count + quick link
- `RecommendationsWidget.tsx` (components/dashboard/) — Recommended items (3-4 cards)
- `SpBalanceWidget.tsx` (components/dashboard/) — SP balance quick view

**User Flow**:
```
Dashboard Tab → [View Recent Trades / Active Listings / Recommendations / SP Balance]
  ├─ Quick Actions: Create Listing, View Messages, View Wallet
  ├─ Widgets: Recent trades (last 3), active listings (count), recommendations (4 items), SP balance
  └─ Navigation: Tap widget → Navigate to detail screen
```

**Design Requirements**:
- Hero section (welcome message, quick action buttons)
- Widget grid (4 sections: recent trades, active listings, recommendations, SP balance)
- Empty states for each widget

---

## 14. Navigation Structure

### Bottom Tab Navigator (4-5 Tabs)

**Active Tabs** (4 confirmed):
1. **Dashboard** (🏠) — Home hub
2. **Discover** (🔍) — Search + browse
3. **Messages** (💬) — Conversations
4. **Profile** (👤) — User profile

**Optional 5th Tab** (Figma team to decide):
5. **Sell** (➕) — Quick create listing (center FAB style)

**Tab Styling**:
- Active: Primary 500 color, icon + label
- Inactive: Neutral 500 color, icon + label
- Badge: Unread message count on Messages tab

---

## 15. Missing Screens & Gaps

### Screens to Design (Not Yet Implemented)

1. **Cart Flow** (FLOW-07):
   - `CartScreen.tsx` — Cart list view
   - `CartCheckoutScreen.tsx` — Multi-item checkout

2. **5th Tab** (Optional):
   - Center FAB for quick listing creation

3. **Dispute Resolution** (Future):
   - `DisputeScreen.tsx` — Trade dispute filing
   - `DisputeDetailScreen.tsx` — Dispute status tracking

4. **Advanced Features** (Future):
   - `SavedSearchesScreen.tsx` — Saved search management
   - `WatchlistScreen.tsx` — Watched items
   - `PromotedListingsScreen.tsx` — Seller promotion management

---

## 16. Component Dependency Matrix

### Shared Components (Used Across Multiple Flows)

| Component | Flows Using It | Priority | Design Variants |
|-----------|----------------|----------|-----------------|
| `ItemCard` | FLOW-06, FLOW-07, Dashboard | P0 | Grid card, list card |
| `SPBadge` | FLOW-10, FLOW-11, FLOW-06 | P0 | Earn badge, spend badge |
| `StatusBadge` | FLOW-08, FLOW-04 | P0 | Trade status, listing status |
| `PaymentMethodCard` | FLOW-08, FLOW-12 | P0 | Card input, saved card display |
| `DisclaimerModal` | FLOW-08, FLOW-12 | P0 | Trade terms, subscription terms |
| `TrialReminderBanner` | FLOW-12, Dashboard | P1 | 7d, 3d, 1d variants |
| `GracePeriodBanner` | FLOW-12, Dashboard | P1 | Grace period nudge |
| `FavoriteButton` | FLOW-06, FLOW-04 | P1 | Heart icon toggle |
| `BadgeShowcase` | FLOW-02, Profile | P2 | Grid view, detail modal |

### Flow-Specific Components

| Flow | Unique Components | Priority |
|------|-------------------|----------|
| FLOW-01 (Auth) | PhoneVerificationModal, SocialLoginButton, AccountLinkingPrompt, SetPasswordModal | P0 |
| FLOW-06 (Discovery) | SearchFilterModal, SearchBar, ActiveFilterChips, SortDropdown | P0 |
| FLOW-04 (Listings) | PhotoPicker, CategoryPicker, ConditionPicker, ListingCard | P0 |
| FLOW-08 (Trading) | TradeSummary, TradeTimelineStep, TradeSuccessGraphic | P0 |
| FLOW-12 (Subscriptions) | SubscriptionTierCard, BillingHistoryRow | P1 |
| FLOW-14 (Messaging) | ConversationRow, MessageBubble, MessageInput | P1 |

---

## 17. Interaction Patterns

### Gestures & Interactions

| Pattern | Usage | Screens | Design Notes |
|---------|-------|---------|--------------|
| **Swipe to Delete** | Remove items from lists | ConversationsListScreen, MyListingsScreen | Left swipe reveals delete button |
| **Pull to Refresh** | Refresh data | DiscoverScreen, ConversationsListScreen, Dashboard | Native iOS/Android pull-down gesture |
| **Infinite Scroll** | Load more results | DiscoverScreen, TransactionHistoryScreen | Load next page when scrolled to bottom |
| **Tap to Navigate** | Open detail screens | All list/grid views | Tap card/row → Navigate to detail |
| **Long Press** | Contextual actions | ItemCard (favorite, share, report) | 300ms hold → Action sheet |
| **Drag to Reorder** | Reorder photos | ItemCreateScreen (photo grid) | Drag handle on photo thumbnails |
| **Pinch to Zoom** | Zoom images | ItemDetailScreen (image carousel) | Pinch gesture on images |
| **Swipe Carousel** | Navigate slides | OnboardingScreen, FeatureHighlightsScreen, ItemDetailScreen | Horizontal swipe between slides |

### Modal Patterns

| Modal Type | Trigger | Dismiss | Usage |
|------------|---------|---------|-------|
| **Bottom Sheet** | Tap filter button, action button | Swipe down, tap backdrop, close button | SearchFilterModal, action sheets |
| **Alert Modal** | Automatic (errors, confirmations) | Tap button (OK, Cancel) | Error messages, confirmations |
| **Full Screen Modal** | Navigation (create listing, edit profile) | Back button, cancel button | ItemCreateScreen, EditProfileScreen |

---

## 18. Data Flow Summary

### Key Data Entities

| Entity | Source | Flows | Display Screens |
|--------|--------|-------|-----------------|
| **User Profile** | Supabase `profiles` table | FLOW-01, FLOW-02 | ProfileScreen, EditProfileScreen |
| **Listings** | Supabase `items` table | FLOW-04, FLOW-06 | DiscoverScreen, ItemDetailScreen, MyListingsScreen |
| **Trades** | Supabase `trades` table | FLOW-08 | TradeListScreen, TradeDetailScreen, TradeTimelineScreen |
| **SP Wallet** | Supabase `sp_wallets` + `sp_ledger` tables | FLOW-10, FLOW-11 | SpWalletScreen, TransactionHistoryScreen |
| **Subscriptions** | Stripe + Supabase `user_subscriptions` | FLOW-12 | SubscriptionStatusScreen, ManageKidsClubScreen |
| **Messages** | Supabase `messages` table (Realtime) | FLOW-14 | ConversationsListScreen, ChatScreen |
| **Notifications** | Supabase `user_notifications` table | FLOW-17 | NotificationCenterScreen |

### State Management

| State Type | Storage | Persistence | Usage |
|------------|---------|-------------|-------|
| **Auth Session** | Supabase JWT (SecureStore) | Persistent | Session restore, API calls |
| **User Preferences** | AsyncStorage | Persistent | Search radius, notification prefs, filter defaults |
| **Search Filters** | React State | Session-only | DiscoverScreen filter state |
| **Cart Items** | AsyncStorage (future) | Persistent | Cart screen (not implemented) |
| **Draft Listings** | AsyncStorage | Persistent | ItemCreateScreen auto-save |

---

## 19. Redesign Priority Roadmap

### Phase 1: Core Flows (Week 1-2)
**P0 Screens** — MVP-blocking, high user impact

1. **Auth & Onboarding** (FLOW-01, FLOW-02):
   - Landing, Login, Signup, Phone Verification
   - Welcome, Profile Completion, Feature Highlights
   - **Estimated**: 8 screens

2. **Discovery** (FLOW-06):
   - Discover (unified search + browse), Item Detail
   - SearchFilterModal
   - **Estimated**: 3 screens + 1 modal

3. **Listing Creation** (FLOW-04):
   - ItemCreateScreen (photo-first)
   - MyListingsScreen
   - **Estimated**: 2 screens

4. **Trading** (FLOW-08):
   - TradeInitiationScreen, TradeDetailScreen, TradeSuccessScreen
   - **Estimated**: 3 screens

5. **Cart** (FLOW-07):
   - CartScreen, CartCheckoutScreen
   - **Estimated**: 2 screens (new)

**Total Phase 1**: 18 screens + 1 modal

---

### Phase 2: Supporting Flows (Week 3)
**P1 Screens** — Important but not blocking

1. **Subscriptions** (FLOW-12):
   - SubscriptionChoiceScreen, SubscriptionPaymentScreen, ManageKidsClubScreen
   - **Estimated**: 3 screens

2. **Messaging** (FLOW-14):
   - ConversationsListScreen, ChatScreen
   - **Estimated**: 2 screens

3. **SP Wallet** (FLOW-10, FLOW-11):
   - SpWalletScreen, TransactionHistoryScreen
   - **Estimated**: 2 screens

4. **Profile** (FLOW-02):
   - ProfileScreen, EditProfileScreen
   - **Estimated**: 2 screens

5. **Dashboard**:
   - UserDashboardScreen
   - **Estimated**: 1 screen

**Total Phase 2**: 10 screens

---

### Phase 3: Remaining Screens (Week 4)
**P2/P3 Screens** — Nice-to-have, lower impact

1. **Seller & Payouts** (FLOW-22):
   - SellerEarningsScreen, PayoutSettingsScreen
   - **Estimated**: 2 screens

2. **Notifications** (FLOW-17):
   - NotificationCenterScreen, NotificationPreferencesScreen
   - **Estimated**: 2 screens

3. **Referrals** (FLOW-13):
   - ReferralDashboardScreen
   - **Estimated**: 1 screen

4. **Legal & Settings**:
   - TermsOfServiceScreen, PrivacyPolicyScreen, SettingsScreen
   - **Estimated**: 3 screens

5. **Misc**:
   - HelpScreen, BadgesScreen, LeaderboardScreen, LocationPickerScreen, NodeSelectionScreen
   - **Estimated**: 5 screens

**Total Phase 3**: 13 screens

---

### Grand Total: 41 screens + 1 modal
(Excludes admin screens, .old files, and duplicate screens to be removed)

---

## 20. Design System Application Guide

### Color Usage by Flow

| Flow | Primary Use | Accent Use | Semantic Use |
|------|-------------|------------|--------------|
| Auth & Onboarding | Primary CTAs (Sign Up, Log In) | Social login icons | Error messages (validation) |
| Discovery | Active filters, favorited items | SP earn badges | Info messages (search tips) |
| Listings | Create listing CTA | SP earn preview | Success (published), Error (CPSC recall) |
| Trading | Primary CTA (Confirm & Pay) | SP spend slider | Success (completed), Error (payment failed) |
| Subscriptions | Subscribe CTA | Trial reminder banners | Warning (grace period), Success (renewed) |
| Messaging | Active conversation highlight | Unread badge | Info (typing indicator) |

### Typography Usage by Screen

| Screen Type | Heading | Body | Caption |
|-------------|---------|------|---------|
| **Landing** | H1 (hero), H2 (sections) | Body Large (value prop) | Caption (fine print) |
| **Forms** (Login, Signup, Listing) | H2 (page title), H4 (section) | Body (labels, descriptions) | Body Small (helper text, validation) |
| **Cards** (Item, Trade, Profile) | H4 (card title) | Body (details) | Body Small (metadata, timestamps) |
| **Modals** | H2 (modal title) | Body (message) | Body Small (disclaimer) |

### Component Usage by Screen

| Screen | Primary Components | Secondary Components |
|--------|-------------------|---------------------|
| **DiscoverScreen** | SearchBar, ItemCard, SearchFilterModal | ActiveFilterChips, SortDropdown, FavoriteButton |
| **ItemDetailScreen** | Image Carousel, ItemCard (detail variant) | SPBadge, FavoriteButton, ShareButton |
| **TradeInitiationScreen** | PaymentMethodCard, TradeSummary, DisclaimerModal | SPSlider, FeeSummary |
| **SubscriptionChoiceScreen** | SubscriptionTierCard | TrialReminderBanner, GracePeriodBanner |

---

## Appendix A: Flow-to-Screen Quick Reference

**Priority 0 (Critical)**:
- FLOW-01: 7 screens (auth)
- FLOW-02: 5 screens (onboarding)
- FLOW-06: 3 screens (discovery)
- FLOW-04: 5 screens (listings)
- FLOW-07: 2 screens (cart - new)
- FLOW-08: 6 screens (trading)

**Priority 1 (High)**:
- FLOW-09: Integrated (fees)
- FLOW-10/11: 2 screens (SP wallet)
- FLOW-12: 8 screens (subscriptions)
- FLOW-14: 2 screens (messaging)
- FLOW-02: 3 screens (profile)

**Priority 2 (Medium)**:
- FLOW-13: 1 screen (referrals)
- FLOW-17: 2 screens (notifications)
- FLOW-21: 1 screen (ID verification)
- FLOW-22: 2 screens (seller payouts)

**Priority 3 (Low)**:
- FLOW-19: 2 screens (education/help)
- Legal: 3 screens (terms, privacy, disclaimer)
- Settings: 1 screen

---

**End of Screen-to-Flow Mapping Document**

---

## Appendix: Missing Flow Mappings

### FLOW-00: Design System & Component Library
**Priority**: Foundation (Complete First)

**Screens** (0 total — Component-only flow, no customer-facing screens)

**Key Components**:
- Color styles: Primary (Orange), Secondary (Teal), Accent (Yellow), Neutrals, Semantic colors
- Text styles: Heading, Body, Technical (Fira Code)
- Component library: Buttons, Cards, Forms, Modals, Badges, Icons
- Spacing tokens (8px base grid)
- Effect styles (Shadow/Card, Shadow/Modal, Shadow/Button)

**Design Requirements**:
- Color palette with tints and shades (8-step system)
- Typography system with 9 text styles
- Auto-layout component sets with variants for state (default, hover, pressed, disabled)
- Spacing tokens as design variables
- Reusable component library organized in folders

**Missing Elements**:
- Custom icon set (currently using placeholder components)
- Brand asset guidelines (logo variations, usage rules)

---

### FLOW-15: Notifications & Alerts
**Priority**: P1 (High) — User engagement driver

**Screens** (2 total):
1. `src/screens/notifications/NotificationsListScreen.tsx`
2. `src/screens/settings/NotificationSettingsScreen.tsx`

**Key Components**:
- `NotificationCard.tsx` (components/notifications/) — Notification item (icon, title, description, timestamp)
- `NotificationFilterChip.tsx` (components/notifications/) — Filter by type (Trades, Messages, SP, System)
- `NotificationSettingsToggle.tsx` (components/settings/) — Category toggle (push, email, in-app)

**User Flow**:
```
Bottom Tab → Notifications Badge (5) 
  ├─ NotificationsListScreen → Tap filter → Show [All/Trades/Messages/SP/System]
  ├─ Tap notification → Navigate to related screen (TradeDetail, Messages, Wallet, etc.)
  ├─ Swipe notification → Mark read or delete
  └─ Settings icon → NotificationSettingsScreen → Toggle categories + channels
```

**Inputs**:
- User interactions: Tap notification, swipe, filter by type, adjust settings

**Outputs**:
- Navigation to related screens (trades, messages, wallet)
- Notification preferences saved
- Push/email/in-app notification delivery state

**Design Requirements**:
- **NotificationsListScreen**: List grouped by date (Today/Yesterday/[Date]), unread badge (blue dot), swipe actions (mark read/delete), filter tabs, mark all as read link
- **NotificationSettingsScreen**: Master toggle, category toggles (Trades, Messages, SP, Subscriptions, Referrals, Listings, Safety, Marketing), sub-toggles (push/email/in-app), quiet hours time picker

**Missing Elements**:
- Push notification handling in-app (currently relies on OS)
- Notification sound customization
- Rich notification templates for trade milestones

---

### FLOW-16: Support & Help Center
**Priority**: P2 (Medium) — User assistance

**Screens** (4 total):
1. `src/screens/help/HelpCenterScreen.tsx`
2. `src/screens/help/FAQDetailScreen.tsx`
3. `src/screens/support/ContactSupportScreen.tsx`
4. `src/screens/support/TicketDetailScreen.tsx`

**Key Components**:
- `HelpSearchBar.tsx` (components/help/) — Full-text search across FAQs and articles
- `CategoryCard.tsx` (components/help/) — Help category with article count
- `ArticleCard.tsx` (components/help/) — Article preview (title, views, date)
- `SupportTicketCard.tsx` (components/support/) — Ticket summary (ID, status, category, replies)
- `MessageBubble.tsx` (components/chat/) — Support agent + user messages

**User Flow**:
```
Settings → Help & Support
  ├─ HelpCenterScreen → Browse categories or search
  │  ├─ Category → Browse articles
  │  └─ Search → Results → Tap article → FAQDetailScreen
  ├─ FAQDetailScreen → Read article → Thumbs up/down → Related articles
  ├─ ContactSupportScreen → Select issue → Describe → Attach screenshots → Submit
  └─ TicketDetailScreen → View status → Chat with agent → Get resolution
```

**Inputs**:
- Search queries
- Issue category selection
- Issue description (text + optional attachments)
- Feedback on articles (helpful/not helpful)

**Outputs**:
- FAQ content display
- Support ticket creation
- Support agent replies
- Ticket resolution status

**Design Requirements**:
- **HelpCenterScreen**: Search bar with trending searches, quick actions (Active Tickets, Contact Support), category cards (icon + article count), popular articles list, community resources
- **FAQDetailScreen**: Article content (rich text formatting), article metadata (views, date), helpful feedback buttons (thumbs up/down), related articles, contact support CTA
- **ContactSupportScreen**: Issue category selector (with icons), description textarea with character counter, optional attachment upload, contact email confirmation, submit button
- **TicketDetailScreen**: Ticket status badge, ticket ID + metadata, message thread (support agent + user messages), reply input, helpful feedback (if resolved)

**Missing Elements**:
- Knowledge base integration (currently hardcoded articles)
- Live chat feature (support agent availability)
- Video tutorials for common issues
- In-app tutorials/walkthroughs

---

### FLOW-18: CPSC Recalls & Admin-Initiated Actions
**Priority**: P1 (High) — Safety & legal compliance

**Screens** (4 total):
1. `src/screens/safety/RecallAlertScreen.tsx` (integrated into FLOW-04 as ListingSafetyReviewScreen)
2. `src/screens/account/AccountSuspendedScreen.tsx`
3. `src/screens/listings/ListingRemovedScreen.tsx`
4. `src/screens/disputes/DisputeResolutionScreen.tsx`

**Key Components**:
- `RecallBanner.tsx` (components/safety/) — CPSC recall alert with product details
- `SuspensionCard.tsx` (components/account/) — Suspension details + appeal form
- `RemovalCard.tsx` (components/listings/) — Listing removal reason + remediation
- `DisputeTimeline.tsx` (components/disputes/) — Trade dispute resolution timeline

**User Flow**:
```
[Background: CPSC database check OR admin flag]
  ├─ Recall detected → Push notification → RecallAlertScreen → Remove/Appeal
  ├─ Account violation → Admin action → Push notification → AccountSuspendedScreen → Appeal
  ├─ Listing flagged → Push notification → ListingRemovedScreen → Appeal/Create new
  └─ Trade dispute filed → Both parties notified → DisputeResolutionScreen → Evidence + messaging → Decision
```

**Inputs**:
- Admin flags (manual or automated)
- CPSC database matches (daily automated check)
- User appeals (appeal form + supporting docs)
- Dispute evidence (messages, photos, receipts)

**Outputs**:
- Listing removal (from search/purchase)
- Account suspension (trade/SP access blocked)
- Dispute resolution decision (refund issued, item retained, etc.)
- Appeal submission to support team

**Design Requirements**:
- **RecallAlertScreen**: Red alert banner with CPSC recall ID + reason, item preview card, recall remediation URL, remove listing + appeal buttons
- **AccountSuspendedScreen**: Suspension details (ID, date, duration), violation reason card, evidence list (related items/trades), impact card (what's blocked), appeal form, support contact
- **ListingRemovedScreen**: Alert icon + message, listing preview card, removal reason (with icon/color coding), evidence section, remediation tips, appeal form, create new listing button
- **DisputeResolutionScreen**: Dispute status badge, parties info (buyer/seller with roles), related trade card, dispute type + details, resolution timeline (5 steps), message thread, evidence display, decision card, appeal option (if dissatisfied)

**Missing Elements**:
- Real-time CPSC database sync (currently manual uploads)
- AI moderation for prohibited items (text + image detection)
- Appeal scoring/routing to priority queue

---

### FLOW-24: MFA / Multi-Factor Authentication Enrollment
**Priority**: P2 (Medium) — Security enhancement

**Screens** (2 total):
1. `src/screens/security/MFASetupScreen.tsx`
2. `src/screens/security/MFAVerificationScreen.tsx`

**Key Components**:
- `AuthMethodSelector.tsx` (components/security/) — MFA method choice (SMS, Email, Authenticator)
- `OTPInput.tsx` (components/auth/) — 6-digit OTP input (reuse from FLOW-01)
- `QRCodeDisplay.tsx` (components/security/) — QR code for authenticator app setup
- `BackupCodesCard.tsx` (components/security/) — Downloadable backup codes

**User Flow**:
```
Profile/Settings → Security → Enable MFA
  ├─ MFASetupScreen → Choose method (SMS/Email/Authenticator app)
  ├─ If SMS/Email → Send code → Wait for receipt
  ├─ If Authenticator → Display QR code → Scan with app → Enter test code
  ├─ MFAVerificationScreen → Enter OTP → Verify
  └─ Success → Download backup codes → Enable MFA
```

**Inputs**:
- MFA method selection (SMS, Email, TOTP authenticator)
- OTP verification code (6 digits)
- QR code scan (if using authenticator app)

**Outputs**:
- MFA enrollment status (enabled/disabled)
- Backup codes (for account recovery)
- MFA method stored in `user_mfa_methods` table

**Design Requirements**:
- **MFASetupScreen**: Method selector (3 options: SMS, Email, Authenticator app), SMS/Email: verification code input, Authenticator: QR code display + manual setup key option, backup codes preview, enable MFA button
- **MFAVerificationScreen**: OTP input (6 boxes), verification countdown timer, resend code link, verify button, confirmation message (MFA enabled)

**Missing Elements**:
- WebAuthn/FIDO2 hardware key support
- Biometric MFA (Face ID, Touch ID)
- MFA enforcement policy (admin can require for certain roles)

---

### FLOW-27: Refunds & Cancellations
**Priority**: P2 (Medium) — Transaction management

**Screens** (3 total):
1. `src/screens/trades/RefundRequestScreen.tsx`
2. `src/screens/trades/RefundStatusScreen.tsx`
3. `src/screens/account/CancellationScreen.tsx` (account deletion)

**Key Components**:
- `RefundReasonSelector.tsx` (components/trades/) — Reason for refund (Item not as described, Item not received, etc.)
- `RefundProgressTimeline.tsx` (components/trades/) — Refund status timeline (Requested → Reviewing → Approved/Denied → Refunded)
- `CancellationWarningCard.tsx` (components/account/) — Account deletion consequences

**User Flow**:
```
Trade Detail → [Action menu] → Request Refund
  ├─ RefundRequestScreen → Select reason → Add explanation + evidence → Submit
  ├─ RefundStatusScreen → View status (Pending/Approved/Denied/Refunded)
  └─ Timeline shows: Requested → Reviewing → Approved → Refunded (with timestamps)

Account Settings → [Danger Zone] → Delete Account
  ├─ CancellationScreen → Confirm consequences → Enter password → Submit
  └─ Account marked as deleted (soft delete, data retained per legal requirements)
```

**Inputs**:
- Refund reason (dropdown + text explanation)
- Evidence attachments (photos, messages, screenshots)
- Account deletion confirmation (password required)

**Outputs**:
- Refund status tracking
- Refund processed (funds returned to payment method)
- Account deletion scheduled (24-hour grace period)

**Design Requirements**:
- **RefundRequestScreen**: Reason selector (Item not as described, Item not received, etc.), explanation textarea, evidence upload, character counter, submit button
- **RefundStatusScreen**: Status timeline (4-5 steps), current status highlight, estimated refund date, refund amount, original payment method display, contact support link
- **CancellationScreen**: Warning banner (red), consequences list (data deletion, listings removal, etc.), password confirmation input, 24-hour grace period message, delete button

**Missing Elements**:
- Partial refunds (refund subset of purchase)
- Refund reason analytics (for improvement)

---

### FLOW-31: Terms of Service
**Priority**: P3 (Low) — Legal/Compliance

**Screens** (1 total):
1. `src/screens/legal/TermsOfServiceScreen.tsx`

**Design Requirements**:
- Scrollable markdown content
- Version number + last updated date (top)
- Sections: User Agreement, Prohibited Conduct, Liability Limitations, Dispute Resolution, Termination, Modifications
- Acceptance checkbox (on first view only)
- No interactive elements

**Missing Elements**:
- None — this is static legal content

---

### FLOW-32: Privacy Policy
**Priority**: P3 (Low) — Legal/Compliance

**Screens** (1 total):
1. `src/screens/legal/PrivacyPolicyScreen.tsx`

**Design Requirements**:
- Scrollable markdown content
- Version number + last updated date (top)
- Sections: Data Collection, Data Usage, Data Sharing, Security, User Rights (CCPA/GDPR), Contact Us
- No interactive elements

**Missing Elements**:
- None — this is static legal content

---

### FLOW-33: Liability Disclaimer
**Priority**: P3 (Low) — Legal/Compliance

**Screens** (1 total):
1. `src/screens/legal/LiabilityDisclaimerScreen.tsx`

**Design Requirements**:
- Scrollable markdown content
- Version number + last updated date (top)
- Sections: As-Is Basis, No Warranties, Limitation of Liability, Indemnification, Third-Party Links, Assumption of Risk
- No interactive elements

**Missing Elements**:
- None — this is static legal content

---

## Summary: All 27 Flows Now Documented

✅ **Complete flow inventory**:
- FLOW-00 through FLOW-24 (with gaps at 05, 09, 23, 25, 26, 29, 30)
- FLOW-27, 31, 32, 33 (legal + advanced features)

**Total: 27 front-end flows** mapped with screens, components, user flows, and design requirements.

