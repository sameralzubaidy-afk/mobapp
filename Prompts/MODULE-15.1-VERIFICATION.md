# MODULE 15.1 VERIFICATION: UI REDESIGN — PASS IT UP (WHISK-INSPIRED DESIGN SYSTEM)

**Scope:** Validate the complete UI redesign of all 27 flows (70 screens) against the Whisk-inspired design system, Phosphor Icons integration, Storyset illustration assets, reusable component library, accessibility standards, and code quality requirements.

---

## 1. Deliverables Checklist

| ID | Deliverable | Status | Evidence Path |
|----|-------------|--------|---------------|
| D-001 | `phosphor-react-native` package installed | ✅ Done | `package.json` → `phosphor-react-native@3.0.6` |
| D-002 | `@expo-google-fonts/inter` + `expo-font` installed | ✅ Done | `package.json` |
| D-003 | `src/assets/illustrations/` directory created | Pending | Directory exists with 4 PNG files |
| D-004 | `onboarding-sp-earning.png` downloaded & placed | Pending | `src/assets/illustrations/onboarding-sp-earning.png` |
| D-005 | `onboarding-safe-trading.png` downloaded & placed | Pending | `src/assets/illustrations/onboarding-safe-trading.png` |
| D-006 | `onboarding-marketplace.png` downloaded & placed | Pending | `src/assets/illustrations/onboarding-marketplace.png` |
| D-007 | `onboarding-sustainable.png` downloaded & placed | Pending | `src/assets/illustrations/onboarding-sustainable.png` |
| D-008 | Shared component: `Button.tsx` created | Pending | `src/components/shared/Button.tsx` |
| D-009 | Shared component: `TextInput.tsx` created | Pending | `src/components/shared/TextInput.tsx` |
| D-010 | Shared component: `ItemCard.tsx` created | Pending | `src/components/discovery/ItemCard.tsx` |
| D-011 | Shared component: `SPBadge.tsx` created | Pending | `src/components/shared/SPBadge.tsx` |
| D-012 | Shared component: `StatusBadge.tsx` created | Pending | `src/components/shared/StatusBadge.tsx` |
| D-013 | Auth component: `OTPInput.tsx` created | Pending | `src/components/auth/OTPInput.tsx` |
| D-014 | Auth component: `SocialLoginButtons.tsx` created | Pending | `src/components/auth/SocialLoginButtons.tsx` |
| D-015 | Shared component: `SearchBar.tsx` created | Pending | `src/components/shared/SearchBar.tsx` |
| D-016 | Shared component: `DisclaimerModal.tsx` created | Pending | `src/components/shared/DisclaimerModal.tsx` |
| D-017 | Shared component: `EmptyState.tsx` created | Pending | `src/components/shared/EmptyState.tsx` |
| D-018 | FLOW-01 Auth (7 screens) redesigned | Pending | All 7 screen files updated |
| D-019 | FLOW-02 Onboarding (5 screens) redesigned | Pending | All 5 screen files updated |
| D-020 | FLOW-03 Node/ZIP (2 screens) redesigned | Pending | All 2 screen files updated |
| D-021 | FLOW-04 Listings (5 screens) redesigned | Pending | All 5 screen files updated |
| D-022 | FLOW-06 Discovery (3 screens) redesigned | Pending | All 3 screen files updated |
| D-023 | FLOW-07 Cart (2 NEW screens) created | Pending | `src/screens/cart/` folder with 2 files |
| D-024 | FLOW-08 Trading (6 screens) redesigned | Pending | All 6 screen files updated |
| D-025 | FLOW-10/11 SP Wallet (2 screens) redesigned | Pending | All 2 screen files updated |
| D-026 | FLOW-12 Subscriptions (8 screens) redesigned | Pending | All 8 screen files updated |
| D-027 | FLOW-13 Referrals (1 screen) redesigned | ✅ Done | `src/screens/referrals/ReferralsScreen.tsx` + tests + Maestro |
| D-028 | FLOW-14 Messaging (2 screens) redesigned | Pending | All 2 screen files updated |
| D-029 | Profile screens (4 screens) redesigned | Pending | All 4 screen files updated |
| D-030 | Dashboard screen redesigned | Pending | Screen file updated |
| D-031 | FLOW-17 Notifications (2 screens) redesigned | Pending | All 2 screen files updated |
| D-032 | FLOW-19 Help (2 screens) redesigned | Pending | All 2 screen files updated |
| D-033 | FLOW-21 ID Verification (1 screen) redesigned | Pending | Screen file updated |
| D-034 | FLOW-22 Payouts (2 screens) redesigned | Pending | All 2 screen files updated |
| D-035 | Legal & Settings (5 screens) redesigned | Pending | All 5 screen files updated |
| D-036 | Misc screens (9 screens) redesigned | Pending | All 9 screen files updated |
| D-037 | TypeScript type-check passes (`yarn typecheck`) | Pending | Zero type errors in output |
| D-038 | No remaining Ionicons imports | Pending | `grep -r "from 'react-native-vector-icons'" src/` returns 0 results |
| D-039 | No hardcoded color values outside design tokens | Pending | Color token file created + audit complete |
| D-040 | WCAG AA accessibility audit passed | Pending | Accessibility checklist completed |

---

## 2. Critical Design System Verification

| Check | Requirement | Pass Criteria | Status |
|-------|-------------|---------------|--------|
| Primary Color | All CTAs and highlights use `#5DBB8E` | `grep -r "#5DBB8E" src/screens` returns results; no orange `#FF6B35` remaining | Pending |
| Button Shape | All primary buttons are pill-shaped | `borderRadius = height / 2` (26px for 52px height) across all buttons | Pending |
| Button Height | Primary buttons 52px, medium 48px, small 40px | Style audits show correct heights | Pending |
| Input Style | All inputs use filled style | `backgroundColor: '#F0F0F0'`, `borderRadius: 12`, NO `borderWidth` on inputs | Pending |
| Input Height | All inputs 52px | Style audits confirm heights | Pending |
| Typography | Inter or system font, correct sizes | 28px headings, 16px body, 13px labels confirmed | Pending |
| Spacing | 20–24px screen padding, 16–20px section spacing | `paddingHorizontal: 24` or `20` on all screen containers | Pending |
| Icon Package | Only Phosphor Icons used | Zero `Ionicons` / `MaterialIcons` / `react-native-vector-icons` imports in `src/` | Pending |
| Icon Weight | All icons use `weight="regular"` (2px stroke) | No `weight="bold"` or `weight="fill"` unless intentional (active state) | Pending |
| Background | All screens white background | `backgroundColor: '#FFFFFF'` on root containers | Pending |
| Text Colors | Correct text hierarchy | `#1A1A1A` primary, `#6B6B6B` secondary, `#999999` tertiary | Pending |
| Error Color | Error states use `#E85D75` | Error messages, validation icons use correct red | Pending |
| SP Gold | SP-related badges use `#F59E0B` | SP badge backgrounds use gold accent | Pending |

---

## 3. Flow-by-Flow Screen Verification

### FLOW-01: Authentication & Session Management (7 screens)
| Screen | File | Icons | Filled Inputs | Pill Button | Status |
|--------|------|-------|---------------|-------------|--------|
| LandingScreen | `src/screens/auth/LandingScreen.tsx` | N/A | N/A | ✅ Green CTA | Pending |
| LoginScreen | `src/screens/auth/LoginScreen.tsx` | EnvelopeSimple, Lock, Eye, EyeSlash | ✅ | ✅ | Pending |
| SignupScreen | `src/screens/auth/SignupScreen.tsx` | EnvelopeSimple, Lock, Eye, EyeSlash, CheckSquare | ✅ | ✅ | Pending |
| PhoneVerificationScreen | `src/screens/auth/PhoneVerificationScreen.tsx` | None | ✅ OTP field | ✅ | Pending |
| ForgotPasswordScreen | `src/screens/auth/ForgotPasswordScreen.tsx` | EnvelopeSimple | ✅ | ✅ | Pending |
| ResetPasswordScreen | `src/screens/auth/ResetPasswordScreen.tsx` | Lock, Eye, EyeSlash | ✅ | ✅ | Pending |
| SuspendedAccountScreen | `src/screens/auth/SuspendedAccountScreen.tsx` | WarningCircle (64px red) | N/A | ✅ Support CTA | Pending |

**Flow-01 Specific Checks:**
- [ ] OTP input uses single field (NOT 6 separate boxes), auto-formats "1 2 3 4 5 6" with letter-spacing
- [ ] Password show/hide toggle works correctly on Login and Signup
- [ ] Terms checkbox on Signup links to Terms and Privacy Policy screens
- [ ] Social login buttons are 50×50px circles with border, not filled
- [ ] Forgot password link is `#5DBB8E` green
- [ ] Suspended screen shows WarningCircle at 64px, `#E85D75` red — NO login/signup buttons

---

### FLOW-02: Profiles & Onboarding (5 screens)
| Screen | File | Illustration Required | Icons | Status |
|--------|------|-----------------------|-------|--------|
| WelcomeScreen | `src/screens/onboarding/WelcomeScreen.tsx` | None | None | Pending |
| ProfileCompletionScreen | `src/screens/onboarding/ProfileCompletionScreen.tsx` | None | User, Camera, CalendarBlank | Pending |
| FeatureHighlightsScreen | `src/screens/onboarding/FeatureHighlightsScreen.tsx` | ⚠️ All 4 Storyset files | DotsThree, CaretRight | Pending |
| OnboardingScreen | `src/screens/onboarding/OnboardingScreen.tsx` | None | DotsThree | Pending |
| ProfileSetupScreen | `src/screens/profile/ProfileSetupScreen.tsx` | None | User, Camera, CalendarBlank | Pending |

**Flow-02 Specific Checks:**
- [ ] FeatureHighlightsScreen carousel has exactly 4 slides
- [ ] Last slide shows "Get Started" (not "Next") button
- [ ] Carousel pagination dots: active `#5DBB8E`, inactive `#E0E0E0`
- [ ] Illustrations render at `width: 280, height: 210` (pt units)
- [ ] Avatar upload area is circular, 120px diameter
- [ ] DOB picker enforces 18+ validation (display-only, no backend change)

---

### FLOW-03: Node/ZIP Gating (2 screens)
| Screen | File | Icons | Status |
|--------|------|-------|--------|
| LocationPickerScreen | `src/screens/onboarding/LocationPickerScreen.tsx` | MapPin, Crosshair | Pending |
| NodeSelectionScreen | `src/screens/onboarding/NodeSelectionScreen.tsx` | Buildings, MapPinLine | Pending |

**Flow-03 Specific Checks:**
- [ ] ZIP input accepts 5 digits only, filled style
- [ ] "Use My Location" button has Crosshair icon, triggers device location
- [ ] Node list cards show name, distance, member count
- [ ] Selected node highlighted with green border or check

---

### FLOW-04: Listing Management (5 screens)
| Screen | File | Icons | Status |
|--------|------|-------|--------|
| ItemCreateScreen | `src/screens/ItemCreateScreen.tsx` | Camera, Image, Plus, X, Coins, Tag, CheckSquare | Pending |
| BulkListingCreateScreen | `src/screens/listing/BulkListingCreateScreen.tsx` | Image, Package | Pending |
| EditListingScreen | `src/screens/listing/EditListingScreen.tsx` | Same as Create | Pending |
| MyListingsScreen | `src/screens/listing/MyListingsScreen.tsx` | Storefront, PencilSimple, Trash, Eye, DotsThree | Pending |
| ListingSafetyReviewScreen | `src/screens/listing/ListingSafetyReviewScreen.tsx` | ShieldWarning, WarningCircle | Pending |

**Flow-04 Specific Checks:**
- [ ] Photo upload area is prominent (first content above the fold)
- [ ] SP earn preview badge shown (estimated SP earnings)
- [ ] Status badges on MyListingsScreen: Active (green), Sold (gray), Expired (yellow), Pending (orange)
- [ ] Safety review screen has "Remove Listing" as primary CTA (red/danger), "Appeal" as secondary

---

### FLOW-06: Discovery & Search (3 screens + modal)
| Screen | File | Icons | Status |
|--------|------|-------|--------|
| DiscoverScreen | `src/screens/home/DiscoverScreen.tsx` | MagnifyingGlass, FunnelSimple, SortAscending, Heart, X | Pending |
| CategoryBrowseScreen | `src/screens/home/CategoryBrowseScreen.tsx` | Category-specific icons | Pending |
| ItemDetailScreen | `src/screens/home/ItemDetailScreen.tsx` | Heart, Share, MapPin, Coins, CheckCircle, ShoppingCart | Pending |
| SearchFilterModal | `src/components/molecules/SearchFilterModal.tsx` | X, FunnelSimple, CheckSquare, SlidersHorizontal | Pending |

**Flow-06 Specific Checks:**
- [ ] Search bar is pill-shaped (48px height, `borderRadius: 24`), filled style
- [ ] Item grid uses `numColumns={2}` with 12px gap between cards
- [ ] Active filter chips are removable (X icon)
- [ ] Filter count badge appears on filter button when filters are active
- [ ] Item image carousel uses pagination dots
- [ ] "Buy Now" button is sticky at bottom of ItemDetailScreen
- [ ] SearchFilterModal slides up from bottom (bottom sheet behavior)
- [ ] "Clear All" and "Apply" buttons present in filter modal

---

### FLOW-07: Cart & Bundling (2 NEW screens)
| Screen | File | Icons | Status |
|--------|------|-------|--------|
| CartScreen | `src/screens/cart/CartScreen.tsx` (NEW) | ShoppingCartSimple, Trash, Package | Pending |
| CartCheckoutScreen | `src/screens/cart/CartCheckoutScreen.tsx` (NEW) | CreditCard, Coins, Receipt | Pending |

**Flow-07 Specific Checks:**
- [ ] `src/screens/cart/` directory created (new)
- [ ] Cart empty state shows Package icon (64px, `#E0E0E0`) + "Start browsing" CTA
- [ ] SP allocation slider in CartCheckoutScreen is functional
- [ ] "Confirm & Pay" is sticky bottom button, green pill

---

### FLOW-08: Trade Flow (6 screens)
| Screen | File | Icons | Status |
|--------|------|-------|--------|
| TradeInitiationScreen | `src/screens/trade/TradeInitiationScreen.tsx` | CreditCard, Coins, Receipt, Lock | Pending |
| TradeDetailScreen | `src/screens/trade/TradeDetailScreen.tsx` | Package, ChatCircle, Receipt, XCircle | Pending |
| TradeListScreen | `src/screens/trade/TradeListScreen.tsx` | Clock, Package, CheckCircle, XCircle | Pending |
| TradeTimelineScreen | `src/screens/trade/TradeTimelineScreen.tsx` | CheckCircle, Circle, Clock | Pending |
| TradeSuccessScreen | `src/screens/trade/TradeSuccessScreen.tsx` | CheckCircle (80px), Star, Receipt | Pending |
| ActiveTradesScreen | `src/screens/trade/ActiveTradesScreen.tsx` | Package | Pending |

**Flow-08 Specific Checks:**
- [ ] Trade timeline has exactly 5 steps; Completed = green check, Current = orange clock, Pending = gray circle
- [ ] TradeSuccessScreen shows large green CheckCircle (80px) — celebration state
- [ ] Disclaimer modal cannot be dismissed without checkbox acceptance
- [ ] SP allocation slider respects admin-configured max percentage
- [ ] Fee breakdown table present on TradeInitiationScreen

---

### FLOW-10/11: Swap Points Wallet (2 screens)
| Screen | File | Icons | Status |
|--------|------|-------|--------|
| SpWalletScreen | `src/screens/sp/SpWalletScreen.tsx` | Wallet, Coins, TrendUp, TrendDown, Clock | Pending |
| TransactionHistoryScreen | `src/screens/profile/TransactionHistoryScreen.tsx` | Receipt, Plus/Minus | Pending |

**Flow-10/11 Specific Checks:**
- [ ] Hero balance card shows Available SP in large green, Pending SP with yellow badge
- [ ] Transaction rows color-coded: Earned (green +), Spent (orange -), Pending (yellow)
- [ ] Filter tabs: All, Earned, Spent
- [ ] "How SP Works" explainer link is present

---

### FLOW-12: Subscriptions (8 screens)
| Screen | File | Icons | Status |
|--------|------|-------|--------|
| SubscriptionChoiceScreen | `src/screens/subscription/SubscriptionChoiceScreen.tsx` | Crown, CrownSimple, CheckCircle | Pending |
| SubscriptionPaymentScreen | `src/screens/subscription/SubscriptionPaymentScreen.tsx` | CreditCard, Calendar | Pending |
| SubscriptionStatusScreen | `src/screens/subscription/SubscriptionStatusScreen.tsx` | Crown, Calendar, CreditCard | Pending |
| SubscriptionSuccessScreen | `src/screens/subscription/SubscriptionSuccessScreen.tsx` | CheckCircle (80px), Crown | Pending |
| ContinueKidsClubScreen | `src/screens/subscription/ContinueKidsClubScreen.tsx` | WarningCircle | Pending |
| ManageKidsClubScreen | `src/screens/subscription/ManageKidsClubScreen.tsx` | Crown, CreditCard, Trash | Pending |
| KidsClubOverviewScreen | `src/screens/subscription/KidsClubOverviewScreen.tsx` | Crown, CheckCircle | Pending |
| BillingHistoryScreen | `src/screens/subscription/BillingHistoryScreen.tsx` | Receipt, Download, CheckCircle, XCircle | Pending |

**Flow-12 Specific Checks:**
- [ ] Monthly/Annual price toggle is functional on SubscriptionChoiceScreen
- [ ] Feature comparison table uses CheckCircle icons (not emoji checkmarks)
- [ ] SubscriptionSuccessScreen matches TradeSuccessScreen celebration pattern
- [ ] Cancel button on ManageKidsClubScreen is styled as danger (red text, not red button)

---

### FLOW-13: Referrals (1 screen)
| Screen | File | Icons | Status |
|--------|------|-------|--------|
| ReferralsScreen | `src/screens/referrals/ReferralsScreen.tsx` | Gift, Copy, ShareNetwork, Coins, Users, CheckCircle, UserCircle | ✅ Done |

**Flow-13 Specific Checks:**
- [x] Referral code is displayed prominently and copyable (tap to copy)
- [x] Share button invokes native share sheet
- [x] Hero card: `#5DBB8E` bg, `Gift` (32px white), "Refer Friends, Earn SP" (18px bold white)
- [x] Code box: white bg, **8px border** `#E0E0E0`, 20px monospace text `letterSpacing: 4`, `Copy` icon (20px green)
- [x] Share button: green pill 52px, `ShareNetwork` icon (18px white)
- [x] SP earned strip: `#FEF3C7` bg, `Coins` (20px `#F59E0B`), bold SP count
- [x] Referral history: avatar (36px), name (15px semibold), date (13px gray), `CheckCircle` (16px green), "+N SP" (13px gold)
- [x] Empty state: `Users` (64px `#E0E0E0`), "No referrals yet — share your code!"
- [x] No Ionicons/MaterialIcons imports (all Phosphor)
- [x] Unit tests created: `src/__tests__/screens/ReferralsScreen.test.tsx`
- [x] Maestro test updated: `.maestro/module-15.1-flow-13-referrals.yaml`
- [x] Manual test guide created: `MODULE-15.1-FLOW-13-MANUAL-TESTING.md`

---

### FLOW-14: Messaging (2 screens)
| Screen | File | Icons | Status |
|--------|------|-------|--------|
| ConversationsListScreen | `src/screens/messaging/ConversationsListScreen.tsx` | ChatCircle, ChatCircleSlash, Bell | Pending |
| ChatScreen | `src/screens/messaging/ChatScreen.tsx` | PaperPlaneRight, PaperClip, Smiley | Pending |

**Flow-14 Specific Checks:**
- [ ] Sent messages bubble: right-aligned, `#5DBB8E` background, white text
- [ ] Received messages bubble: left-aligned, `#F0F0F0` background, dark text
- [ ] Message input is sticky at bottom, filled style
- [ ] Send button is green circle with PaperPlaneRight icon (not text)
- [ ] Unread badge count visible on conversation rows

---

### Profile Screens (4 screens) — FLOW-15
| Screen | File | Icons | Status |
|--------|------|-------|--------|
| MyProfileScreen | `src/screens/profile/MyProfileScreen.tsx` | Camera, ShieldCheck, MapPin, PencilSimple | Pending |
| EditProfileScreen | `src/screens/profile/EditProfileScreen.tsx` | User, Camera, MapPin | Pending |
| SellerProfileScreen | `src/screens/profile/SellerProfileScreen.tsx` | Star, ShieldCheck, MapPin, UserPlus, Check | Pending |
| BadgesScreen | `src/screens/profile/BadgesScreen.tsx` | Medal, Lock | Pending |

**Profile Specific Checks:**
- [ ] Avatar is 96px circle, `#F0F0F0` placeholder background
- [ ] Camera overlay on avatar: 28px `#5DBB8E` circle, bottom-right, `Camera` icon white (14px)
- [ ] `ShieldCheck` (16px, `#5DBB8E`) shows inline after name on verified profiles
- [ ] Stats row: 3 chips on `#F7F7F7`, 12px radius (Listings / Trades / SP Balance)
- [ ] "Edit Profile" button: secondary outlined border `#5DBB8E`, NOT filled, `PencilSimple` icon left
- [ ] Edit profile inputs: filled style (`#F0F0F0`, 12px radius, no border, 52px height)
- [ ] Bio textarea: filled style, `minHeight: 100`, `textAlignVertical: 'top'`
- [ ] "Save Changes": green pill, 52px, sticky bottom
- [ ] SellerProfileScreen star ratings: `#F59E0B` fill (weight="fill") for rated, `#E0E0E0` outline for unrated
- [ ] "Follow" button: green filled pill, `UserPlus` (16px white) icon left
- [ ] "Following" state: secondary outlined, `Check` (16px `#5DBB8E`) icon — NOT filled
- [ ] Badges grid: 3 columns, 12px gap, 16px horizontal padding
- [ ] Earned badge cells: `#FFF9EC` bg, `Medal` (28px, `#F59E0B`), label 13px semibold `#1A1A1A`
- [ ] Locked badge cells: `#F7F7F7` bg, `Medal` (28px, `#CCCCCC`), label 13px `#999999`, `opacity: 0.6`
- [ ] Badge detail modal: bottom sheet style, `borderTopLeftRadius: 16`, `borderTopRightRadius: 16`, white bg
- [ ] Locked badge modal shows `Lock` (24px, `#CCCCCC`) at top — earned modal does NOT

---

### Dashboard Screen (1 screen)
| Screen | File | Icons | Status |
|--------|------|-------|--------|
| UserDashboardScreen | `src/screens/dashboard/UserDashboardScreen.tsx` | House, Plus, ChatCircle, Wallet, Package, Storefront, MagnifyingGlass | Pending |

**Dashboard Specific Checks:**
- [ ] Welcome message personalised: "Welcome back, [Name]!"
- [ ] Quick action row (Create Listing, Messages, Wallet) renders horizontally
- [ ] All 4 widgets have empty state handling

---

### FLOW-17: Notifications (2 screens)
| Screen | File | Icons | Status |
|--------|------|-------|--------|
| NotificationCenterScreen | `src/screens/notifications/NotificationCenterScreen.tsx` | Bell, BellFill, Check, Trash | Pending |
| NotificationPreferencesScreen | `src/screens/profile/NotificationPreferencesScreen.tsx` | Bell, ToggleLeft, ToggleRight | Pending |

---

### FLOW-19: Help (2 screens)
| Screen | File | Icons | Status |
|--------|------|-------|--------|
| HelpScreen | `src/screens/help/HelpScreen.tsx` | Question, MagnifyingGlass, Lifebuoy | Pending |
| OnboardingScreen (Trading Ed) | Already covered in FLOW-02 | — | Pending |

---

### FLOW-21: ID Verification (1 screen)
| Screen | File | Icons | Status |
|--------|------|-------|--------|
| IDVerificationUploadScreen | `src/screens/profile/IDVerificationUploadScreen.tsx` | IdentificationCard, Camera, ShieldCheck | Pending |

---

### FLOW-22: Payouts (2 screens)
| Screen | File | Icons | Status |
|--------|------|-------|--------|
| SellerEarningsScreen | `src/screens/seller/SellerEarningsScreen.tsx` | ChartLine, TrendUp, CreditCard, Download | Pending |
| PayoutSettingsScreen | `src/screens/seller/PayoutSettingsScreen.tsx` | CreditCard, At, Plus | Pending |

---

### Legal & Settings (5 screens) — FLOW-25
| Screen | File | Icons | Status |
|--------|------|-------|--------|
| SettingsScreen | `src/screens/settings/SettingsScreen.tsx` | Gear, Lock, FileText, Shield, Sun, Moon, Translate, SignOut, Trash, CaretRight | Pending |
| PrivacyPolicyScreen | `src/screens/legal/PrivacyPolicyScreen.tsx` | FileText | Pending |
| TermsOfServiceScreen | `src/screens/legal/TermsOfServiceScreen.tsx` | FileText | Pending |
| DeleteAccountScreen | `src/screens/settings/DeleteAccountScreen.tsx` | Trash, X, Lock | Pending |
| LiabilityDisclaimerScreen | `src/screens/settings/LiabilityDisclaimerScreen.tsx` | WarningCircle | Pending |

**Legal & Settings Specific Checks:**
- [ ] Settings section headers: `#F7F7F7` bg, 12px uppercase `#6B6B6B` text
- [ ] All navigable settings rows: left icon (20px) + label (15px `#1A1A1A`) + `CaretRight` (16px, `#999999`) right
- [ ] Switch rows use `trackColor={{ false: '#E0E0E0', true: '#5DBB8E' }}`, white thumb
- [ ] "Sign Out" and "Delete Account" rows: icon + label both `#E85D75` — NOT standard green
- [ ] PrivacyPolicyScreen / TermsOfServiceScreen: section headings 17px semibold, body 15px `#6B6B6B`, `lineHeight: 24`
- [ ] Last updated line: 13px, `#999999`
- [ ] Scroll padding: `paddingHorizontal: 20`, `paddingBottom: 40`
- [ ] DeleteAccountScreen: `Trash` icon 64px, `#E85D75`, centered at top
- [ ] Delete Account consequences list uses `X` (14px, `#E85D75`) per item
- [ ] Password confirmation input on DeleteAccountScreen: filled style, `Lock` icon left (20px, `#6B6B6B`)
- [ ] "Delete My Account" button: `#E85D75` bg red pill, 52px — NOT green
- [ ] "Cancel" on DeleteAccountScreen is a text link — NOT a button
- [ ] LiabilityDisclaimerScreen: `WarningCircle` (48px, `#F59E0B`, `weight="fill"`) centered at top — NOT red
- [ ] LiabilityDisclaimerScreen heading: 22px semibold, centered
- [ ] LiabilityDisclaimerScreen body typography matches PrivacyPolicyScreen exactly
- [ ] LiabilityDisclaimerScreen has NO buttons or CTAs — read-only

---

### Misc Screens (9 screens)
| Screen | File | Icons | Status |
|--------|------|-------|--------|
| LeaderboardScreen | `src/screens/LeaderboardScreen.tsx` | Medal, Crown | Pending |
| ListingRemovedScreen | `src/screens/listings/ListingRemovedScreen.tsx` | WarningCircle, Trash | Pending |
| DisputeResolutionScreen | `src/screens/disputes/DisputeResolutionScreen.tsx` | Warning, ChatCircle, Receipt | Pending |
| RefundRequestScreen | `src/screens/trades/RefundRequestScreen.tsx` | CurrencyDollar, Upload | Pending |
| RefundStatusScreen | `src/screens/trades/RefundStatusScreen.tsx` | Clock, CheckCircle, XCircle | Pending |
| MFASetupScreen | `src/screens/security/MFASetupScreen.tsx` | Lock, Phone, Envelope, QrCode | Pending |
| MFAVerificationScreen | `src/screens/security/MFAVerificationScreen.tsx` | Lock | Pending |

---

## 4. Reusable Component Library Verification

| Component | File | Variants | Props | TypeScript | Status |
|-----------|------|----------|-------|------------|--------|
| Button | `src/components/shared/Button.tsx` | primary, secondary, text | variant, size, onPress, disabled, loading, icon | ✅ | Pending |
| TextInput | `src/components/shared/TextInput.tsx` | default, error, focus | label, placeholder, error, leftIcon, rightIcon | ✅ | Pending |
| ItemCard | `src/components/discovery/ItemCard.tsx` | default, favorite | item, onPress, onFavoriteToggle | ✅ | Pending |
| SPBadge | `src/components/shared/SPBadge.tsx` | earn, spend | amount, variant | ✅ | Pending |
| StatusBadge | `src/components/shared/StatusBadge.tsx` | success, warning, error, neutral | status, variant | ✅ | Pending |
| OTPInput | `src/components/auth/OTPInput.tsx` | default, error | value, onChange, length, error, onComplete | ✅ | Pending |
| SocialLoginButtons | `src/components/auth/SocialLoginButtons.tsx` | signup, login | mode, onGooglePress, onApplePress, onFacebookPress | ✅ | Pending |
| SearchBar | `src/components/shared/SearchBar.tsx` | default | value, onChangeText, onSubmit, placeholder | ✅ | Pending |
| DisclaimerModal | `src/components/shared/DisclaimerModal.tsx` | blocking, dismissible | visible, title, content, onAccept, onDismiss, requireAcceptance | ✅ | Pending |
| EmptyState | `src/components/shared/EmptyState.tsx` | with CTA, without CTA | icon, title, description, buttonText, onButtonPress | ✅ | Pending |

**Component Checks:**
- [ ] `Button` loading state shows ActivityIndicator in white, disables press
- [ ] `Button` disabled state renders at 50% opacity
- [ ] `TextInput` error state shows red tint on background and red message below
- [ ] `OTPInput` auto-submits when 6 digits entered (`onComplete` fires)
- [ ] `ItemCard` favorite icon toggles between `Heart` (outline) and `HeartFill` (filled green)
- [ ] `SPBadge` earn variant: green background; spend variant: gold `#F59E0B` background
- [ ] `EmptyState` icon renders at 64px, `#E0E0E0` (light gray)
- [ ] `DisclaimerModal` cannot be dismissed via backdrop tap when `requireAcceptance={true}`

---

## 5. Asset Verification

### Phosphor Icons
```bash
# Run to confirm installation:
cat p2p-kids-marketplace/package.json | grep phosphor
# Expected: "phosphor-react-native": "^3.0.6"

# Confirm no legacy icon packages remain:
grep -r "react-native-vector-icons\|Ionicons\|MaterialIcons\|FontAwesome" src/ --include="*.tsx" --include="*.ts"
# Expected: 0 results
```

### Storyset Illustrations
```bash
# Run to confirm all 4 illustration files exist:
ls src/assets/illustrations/
# Expected output:
# onboarding-sp-earning.png
# onboarding-safe-trading.png
# onboarding-marketplace.png
# onboarding-sustainable.png

# Confirm file dimensions (should be 560×420px @ 2x):
file src/assets/illustrations/*.png
```

**Illustration Spec Verification:**
- [ ] Each PNG is 560×420px actual size (280×210pt @ 2x)
- [ ] Transparent background (PNG with alpha)
- [ ] Primary color customized to `#5DBB8E` in Storyset editor
- [ ] Accent color customized to `#F59E0B` in Storyset editor

### Inter Font
```bash
# Confirm font packages installed:
cat package.json | grep -E "inter|expo-font"
# Expected: @expo-google-fonts/inter and expo-font present
```

---

## 6. Code Quality Verification

### TypeScript
```bash
cd p2p-kids-marketplace && yarn typecheck
# Expected: 0 errors
```

| Check | Command | Expected |
|-------|---------|----------|
| Type errors | `yarn typecheck` | 0 errors |
| Lint errors | `yarn lint` | 0 errors or warnings |
| Import validation | `grep -r "from 'phosphor-react-native'" src/screens` | All icon imports present |
| No hardcoded oranges | `grep -r "#FF6B35\|#F97316\|#EA580C" src/` | 0 results |
| No hardcoded colors (spot check) | `grep -r "color: '#" src/screens` | Should be 0 (use tokens) |

### Design Token Audit
- [ ] `src/theme/colors.ts` (or equivalent) created with all color constants
- [ ] `src/theme/typography.ts` created with font size/weight constants
- [ ] `src/theme/spacing.ts` created with spacing constants
- [ ] All screens import from theme instead of hardcoding values

---

## 7. Accessibility Verification

| Check | Standard | Method | Status |
|-------|----------|--------|--------|
| Text contrast (primary) | WCAG AA 4.5:1 | `#1A1A1A` on `#FFFFFF` = 19.1:1 ✅ | Pending |
| Text contrast (secondary) | WCAG AA 4.5:1 | `#6B6B6B` on `#FFFFFF` = 5.9:1 ✅ | Pending |
| Text contrast (placeholder) | WCAG AA 4.5:1 | `#999999` on `#F0F0F0` = 2.85:1 ⚠️ Informational only | Pending |
| Button contrast | WCAG AA 3:1 UI | `#FFFFFF` on `#5DBB8E` = 3.1:1 ✅ | Pending |
| Touch target size | 44×44px minimum | All interactive elements meet minimum | Pending |
| Icon labels | Screen reader | All icon-only buttons have `accessibilityLabel` prop | Pending |
| Focus states | Visible | Focus ring visible on all interactive elements (keyboard nav) | Pending |
| Image alt text | Screen reader | All `<Image>` components have `accessibilityLabel` | Pending |

**Accessibility Spot Checks:**
- [ ] Icon-only buttons (filter, sort, favorite) all have `accessibilityLabel`
- [ ] OTP input has `accessibilityLabel="One-time password"` and `accessibilityHint`
- [ ] Social login buttons labeled "Sign in with Google", "Sign in with Apple", etc.
- [ ] Avatar images have `accessibilityLabel` with user name
- [ ] Status badges have `accessibilityRole="text"` and descriptive labels

---

## 8. Visual QA Checklist

### Screen-Level Checks (run on iOS Simulator + Android Emulator)
- [ ] No layout overflow on small screens (iPhone SE 375px width)
- [ ] No clipped text on large fonts (Accessibility > Larger Text)
- [ ] Keyboard does not cover input fields (KeyboardAvoidingView working)
- [ ] Safe area insets respected (notch, home indicator area)
- [ ] Dark mode: No invisible text (white on white or black on black)
- [ ] RTL layout (if supported): Elements mirror correctly

### Interaction Checks
- [ ] All buttons show pressed state (opacity feedback or ripple)
- [ ] Loading states prevent double-tap (disabled during API call)
- [ ] Pull-to-refresh on list screens works
- [ ] Infinite scroll on DiscoverScreen loads more items
- [ ] Carousel swipe gesture works on FeatureHighlightsScreen
- [ ] Bottom sheet modal animates smoothly (SearchFilterModal)
- [ ] Input fields auto-scroll into view when keyboard opens

---

## 9. Performance Checks

| Metric | Target | Notes |
|--------|--------|-------|
| Cold start to LandingScreen | < 2.5s | Includes font loading |
| Discover screen FlatList scroll | 60 FPS | Use `getItemLayout` if possible |
| Image load (ItemCard) | < 1s on WiFi | Use `FastImage` or Expo Image |
| Carousel slide animation | 60 FPS | Use `useNativeDriver: true` |
| Bottom sheet open animation | < 300ms | Native animation preferred |
| OTPInput auto-format lag | < 16ms | No visible delay on typing |

---

## 10. Known Limitations & Risks

- **Illustration dependency:** FeatureHighlightsScreen cannot be completed until all 4 Storyset PNG files are downloaded and customized. Use colored placeholder rectangles in the interim.
- **Theme tokens:** If a central theme/token system does not exist in the codebase, hardcoded colors are acceptable in first pass — with a TODO comment to replace later.
- **Social login:** Google/Apple/Facebook icon-only buttons may require `@react-native-google-signin/google-signin` and `@invertase/react-native-apple-authentication` native modules — verify existing integrations before replacing UI.
- **Stripe CardField:** TradeInitiationScreen uses Stripe's native CardField component — cannot be redesigned with custom styles beyond Stripe's theme API.
- **OTP single field:** Some existing flows may use 6-box OTP pattern. Migration to single field requires updating state management alongside the UI change.

---

## 11. Post-Redesign Enhancements (Backlog)

1. Replace all hardcoded colors with design token imports (`src/theme/colors.ts`)
2. Add dark mode theme support (dark token variant)
3. Add haptic feedback to primary button presses
4. Add skeleton loading screens to replace ActivityIndicator on list screens
5. Animate badge unlock modal with confetti (TradeSuccessScreen, SubscriptionSuccessScreen)
6. Add micro-animations to SP balance changes (counter animation)
7. Implement React Native Reanimated for smoother carousel transitions

---

## 12. Sign-Off Checklist

| Item | Reviewer | Status |
|------|----------|--------|
| All 10 components created & tested | Engineering | Pending |
| All 70 screens redesigned (visual QA) | Engineering + Design | Pending |
| TypeScript check passes (0 errors) | Engineering | Pending |
| No legacy icon imports remaining | Engineering | Pending |
| Accessibility audit passed | QA | Pending |
| Phosphor Icons license confirmed ($49) | Product/Finance | Pending |
| Storyset illustration assets placed | Design | Pending |
| Performance baselines met | Engineering | Pending |
| Design review against design-system-passitup.md | Design Lead | Pending |
| Final go/no-go for production build | Tech Lead | Pending |

Sign-off requires: all 68 screens complete, 0 TypeScript errors, 0 legacy icon imports, and accessibility checks passed.

---

## 13. Acceptance Criteria Summary

✓ All 27 flows (70 screens) redesigned with Whisk-inspired design system  
✓ `phosphor-react-native@3.0.6` installed and used for all icons  
✓ Zero `Ionicons` / `MaterialIcons` / `react-native-vector-icons` imports remaining  
✓ All 4 Storyset illustrations downloaded, customized, and placed in `src/assets/illustrations/`  
✓ All 10 reusable components created with TypeScript props  
✓ Primary color `#5DBB8E` consistent across all screens  
✓ All buttons pill-shaped (borderRadius = height / 2)  
✓ All inputs filled style (`#F0F0F0`, 12px radius, no borders)  
✓ WCAG AA accessibility audit passed  
✓ `yarn typecheck` returns 0 errors  
✓ Visual QA passed on both iOS and Android  
