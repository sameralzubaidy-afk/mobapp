# MODULE-15.1 FLOW-12: SUBSCRIPTION UI — MANUAL TESTING GUIDE

**Test Environment:** iOS/Android Simulators  
**Test Type:** Manual UI Verification  
**Tools:** Expo, iOS Simulator, Android Emulator  

---

## 📱 SETUP

### Prerequisites

```bash
cd p2p-kids-marketplace
npm install
```

### Launch Simulators

**iOS:**
```bash
npx expo start --ios
```

**Android:**
```bash
npx expo start --android
```

---

## 🧪 TEST CASES

### **TC-01: Free User Views Subscription Plans**

**Objective:** Verify Free tier user can view the 2 actual tiers with correct styling.

**Steps:**
1. Launch app
2. **Login as Free tier user** (or create new account)
3. Tap **Profile** tab
4. Tap **"View Subscription Plans"** link
5. Observe **SubscriptionPlans** screen

**Expected Results:**
- ✅ Screen title: "Choose Your Plan"
- ✅ 2 plan cards visible:
  - **Free:** white bg, gray 1px border (#E0E0E0), gray `CrownSimple` icon (24px)
  - **Kids Club+:** white bg, green 2px border (#5DBB8E), green `Crown` icon (24px, filled)
- ✅ Free plan shows "Current" button (gray #F0F0F0 bg)
- ✅ Kids Club+ plan shows "Start 30-day Trial" button (green #5DBB8E pill, 52px height)
- ✅ Kids Club+ price shows monthly amount (default $4.99/month unless admin config overrides)
- ✅ "Compare Plans" link visible at bottom (green text #5DBB8E, 14px)

**TestIDs to verify (Maestro/automation):**
- `subscription-plans-screen`
- `plan-card-free`, `plan-card-kids_club_plus`
- `cta-button-free`, `cta-button-kids_club_plus`
- `compare-plans-link`

---

### **TC-02: Plan Comparison View**

**Objective:** Verify enhanced comparison screen with hero section, value prop, benefits highlight, and compelling design.

**Steps:**
1. From SubscriptionPlans screen
2. Tap **"Compare Plans"** link
3. Observe **PlanComparison** screen

**Expected Results:**

**Hero Header:**
- ✅ Light green gradient background (#F0FDF4)
- ✅ Green filled Crown icon (40px, #5DBB8E) centered
- ✅ Title: "Choose What Works For You" (26px bold, #1A1A1A)
- ✅ Subtitle: "Join thousands of parents trading smarter" (16px, #6B6B6B)

**Value Proposition Banner:**
- ✅ Light green box (#E8F5F0) with green left border (4px, #5DBB8E)
- ✅ Text: "💡 **Kids Club+** members save an average of $45/month"
- ✅ Rounded corners (12px), centered text

**Column Headers:**
- ✅ **Free Column:**
  - Gray CrownSimple icon (20px)
  - "Free" title (15px bold)
  - "$0" price (20px bold)
  - "Forever" subtext (11px gray)
  - Gray border-bottom (2px, #E0E0E0)
- ✅ **Kids Club+ Column:**
  - "POPULAR" badge at top (green #5DBB8E, white text, 10px)
  - Light green background (#F0FDF4), rounded corners
  - Green filled Crown icon (24px)
  - "Kids Club+" title (15px bold green)
  - Dynamic price (20px bold green) **Note: Should show ~$4.99, NOT $1500**
  - "/month" subtext (12px green)
  - Green border-bottom (3px, #5DBB8E)

**Feature Rows:**
- ✅ 5 feature rows (only implemented features):
  - Monthly subscription
  - Free trial
  - Transaction fee
  - Trade with PIPs
  - Reduced transaction fee
- ✅ Kids Club+ column has subtle green highlight (#F0FDF4)
- ✅ Icons: `CheckCircle` (green) or `X` (gray)

**Benefits Highlight Section:**
- ✅ Gray background box (#F9FAFB) with rounded corners (16px)
- ✅ Title: "Why Upgrade to Kids Club+?" (18px bold, centered)
- ✅ 3 benefit items with green checkmarks:
  - "**Trade with PIPs** — help others save while saving yourself"
  - "**Lower fees** — keep more of what you earn"
  - "**{X}-day free trial** — try risk-free, cancel anytime"
- ✅ Each benefit has CheckCircle icon (20px, #5DBB8E filled)

**CTA Buttons:**
- ✅ Larger buttons (48px height) with subtle shadows
- ✅ Free: "Current" (gray #F0F0F0)
- ✅ Kids Club+: "Start {X}-day Trial" (green pill #5DBB8E, 15px bold text)

**Trust Badge Footer:**
- ✅ Gray text: "✓ Cancel anytime · No hidden fees · Safe & secure"
- ✅ Centered, 13px, #999999

**TestIDs to verify:**
- `plan-comparison-screen`
- `header-free`, `header-kids-club-plus`
- `feature-row-0` through `feature-row-4` (5 rows only)
- `choose-free`, `choose-kids-club-plus`

---

### **⚠️ KNOWN ISSUE: Price Display Bug**

If the screen shows **$1500.00** instead of **~$4.99**, this is a database configuration issue:

**Root Cause:** The `admin_config.subscription_price_monthly` value is stored incorrectly.

**Fix (run in Supabase SQL Editor):**
```sql
-- Check current value
SELECT subscription_price_monthly FROM admin_config WHERE id = 1;

-- If it shows 150000 or 1500, fix it to 499 (cents = $4.99)
UPDATE admin_config 
SET subscription_price_monthly = 499  -- $4.99 in cents
WHERE id = 1;

-- Verify fix
SELECT subscription_price_monthly FROM admin_config WHERE id = 1;
-- Should return: 499
```

After fixing, force-refresh the app to see the correct $4.99 price.

---

### **TC-03: Upgrade Plan (Current Plan Overlay)**

**Objective:** Verify current plan is visually dimmed when viewing upgrade options.

**Prerequisites:** User is on Free tier.

**Steps:**
1. Navigate to SubscriptionPlans screen
2. Tap **"Start 30-day Trial"** CTA
3. **Mock successful payment** (or cancel and return)
4. Navigate to **"Upgrade Plan"** screen from Profile/Settings menu

**Expected Results (if user is on Free plan):**
- ✅ Screen title: "Manage Your Plan"
- ✅ Free plan card has 50% opacity overlay
- ✅ Free plan shows "Current Plan" chip (gray #F0F0F0 bg, centered)
- ✅ Kids Club+ plan CTA says "Start 30-day Trial" (green, enabled)

**Expected Results (if user is on Kids Club+ plan):**
- ✅ Kids Club+ plan card has 50% opacity overlay
- ✅ Kids Club+ plan shows "Current Plan" chip (green #5DBB8E bg)
- ✅ Free plan CTA says "Downgrade" and is disabled (gray, no tap)
- ✅ Kids Club+ plan shows "Managing" state (button disabled)

**TestIDs to verify:**
- `upgrade-plan-screen`
- `current-plan-chip`
- `cta-button-free`, `cta-button-kids-club-plus`

---

### **TC-04: Cancel Subscription Flow**

**Objective:** Verify retention-focused cancel screen with benefits reminder.

**Prerequisites:** User must be on **Kids Club+** paid plan.

**Steps:**
1. Navigate to **MySubscription** screen
2. Tap **"Cancel Subscription"** link (red text at bottom)
3. Observe **CancelSubscription** screen

**Expected Results:**
- ✅ Screen title: "Cancel Subscription"
- ✅ Warning banner at top:
  - Background: #FEE2E2 (light red)
  - Icon: `WarningCircle` (20px, #E85D75 red, filled)
  - Text: "You'll lose these benefits" (#E85D75, 14px)
- ✅ Benefits list shows 7 items with red `X` icons (16px, #E85D75, bold):
  - Earn Swap Points on every successful trade
  - Spend Swap Points to reduce purchase prices
  - Donate items for community impact
  - Reduced transaction fee ($0.99 vs $2.99)
  - Priority matching in discovery
  - Early access to new features
  - Priority support when you need help
- ✅ Confirmation text (15px, #6B6B6B) explains consequences: "All Kids Club+ benefits will be removed."
- ✅ Primary CTA: **"Keep My Subscription"** (green pill #5DBB8E, 52px height)
- ✅ Secondary action: **"Cancel Anyway"** (red text link #E85D75, 14px, below button)

**User Action 1: Tap "Keep My Subscription"**
- ✅ Navigates back to MySubscription screen
- ✅ Subscription remains active

**User Action 2: Tap "Cancel Anyway"**
- ✅ Alert confirmation appears:
  - Title: "Cancel Subscription?"
  - Message: "Are you sure? You'll lose access to all Kids Club+ benefits."
  - Buttons: "Go Back" (cancel, gray) + "Yes, Cancel Subscription" (destructive red)
- ✅ **Tap "Go Back":** Alert dismisses, stays on CancelSubscription screen
- ✅ **Tap "Yes, Cancel Subscription":** 
  - Calls `cancelSubscription('user_requested')`
  - Shows success alert: "Subscription Cancelled"
  - Navigates to MySubscription screen
  - Subscription status updates to "cancelled"
  - User can see upgrade option again

**TestIDs to verify:**
- `cancel-subscription-screen`
- `warning-banner`
- `benefit-0` through `benefit-5`
- `keep-subscription-button`
- `cancel-anyway-link`

---

### **TC-05: Subscription Expired Screen**

**Objective:** Verify expired state with amber warning icon and renewal CTA.

**Trigger:** Subscription expiration detected (backend sets status to 'expired').

**Steps:**
1. **Mock expired subscription** (use test account with expired date in past)
2. Navigate to app after expiration
3. User is redirected to **SubscriptionExpired** screen automatically

**Expected Results:**
- ✅ Screen title hidden (fullscreen view)
- ✅ Icon: `WarningCircle` (64px, **amber #FFA726**, NOT red) — centered
- ✅ Title: "Subscription Expired" (24px semibold, #1A1A1A)
- ✅ Message: "Your {planName} plan expired on {expiredDate}" (15px, #6B6B6B)
  - Example: "Your Kids Club+ plan expired on 12/31/2024"
- ✅ Subtext: "Renew now to get back all your Kids Club+ benefits..." (14px, #999999)
- ✅ Primary CTA: **"Renew Now"** (green pill #5DBB8E, 52px height)
- ✅ Secondary action: **"Continue with Free Plan"** (gray text link #6B6B6B, 14px)

**User Action 1: Tap "Renew Now"**
- ✅ Navigates to SubscriptionPayment screen with `isRenewal: true` param

**User Action 2: Tap "Continue with Free Plan"**
- ✅ Navigates to DiscoverScreen (Home feed)

**TestIDs to verify:**
- `subscription-expired-screen`
- `warning-icon`
- `title`
- `message`
- `renew-button`
- `continue-free-link`

---

### **TC-06: Subscription Success — Kids Club+ Plan**

**Objective:** Verify success screen shows Crown icon for Kids Club+ tier.

**Steps:**
1. Complete payment for **Kids Club+ plan**
2. Navigate to **SubscriptionSuccess** screen

**Expected Results:**
- ✅ Icon: `Crown` (64px, **#5DBB8E green**, **filled**) — centered
- ✅ Title: "You're now a Kids Club+ member!" (24px semibold, #1A1A1A)
- ✅ Subtitle: "Your subscription is now active. Let's get started!" (15px, #6B6B6B)
- ✅ 3 benefit chips in a row (horizontal):
  - "Earn SP" (#E8F5F0 bg, #5DBB8E text)
  - "Low Fees" (#E8F5F0 bg, #5DBB8E text)
  - "Priority" (#E8F5F0 bg, #5DBB8E text)
- ✅ Primary CTA: **"Start Exploring"** (green pill #5DBB8E, 52px height)

**User Action: Tap "Start Exploring"**
- ✅ Navigates to DiscoverScreen (Search tab)

**TestIDs to verify:**
- `subscription-success-screen`
- `crown-icon` (for Kids Club+)
- `title`
- `benefit-chip-0`, `benefit-chip-1`, `benefit-chip-2`
- `start-exploring-button`

---

### **TC-07: Subscription Success — Trial Started**

**Objective:** Verify success screen for trial start (same as TC-06, alternate flow).

**Steps:**
1. Start 30-day trial for **Kids Club+**
2. Navigate to **SubscriptionSuccess** screen

**Expected Results:**
- ✅ Icon: `Crown` (64px, **#5DBB8E green**, **filled**) — centered
- ✅ Title: "You're now a Kids Club+ member!" (24px semibold, #1A1A1A)
- ✅ Subtitle: "Your 30-day trial is now active. Enjoy all premium features!" (15px, #6B6B6B)
- ✅ 3 benefit chips: same as TC-06
- ✅ Primary CTA: **"Start Exploring"** (green pill #5DBB8E, 52px height)
- ✅ Small text below CTA: "Trial expires on {date}" (12px, #999999)

**TestIDs to verify:**
- `subscription-success-screen`
- `crown-icon` (for Kids Club+)
- `title`
- `trial-expiry-text`
- `start-exploring-button`

---

### **TC-08: My Subscription — Active Kids Club+ Plan**

**Objective:** Verify user can view active Kids Club+ subscription details.

**Prerequisites:** User has active Kids Club+ paid plan.

**Steps:**
1. Navigate to **Profile** tab
2. Tap **"My Subscription"** link
3. Observe **MySubscription** screen

**Expected Results:**
- ✅ Screen title: "My Subscription"
- ✅ Plan card:
  - Border: green 2px (#5DBB8E)
  - Icon: `Crown` (32px, #5DBB8E filled)
  - Plan name: "Kids Club+ Plan" (20px semibold, #5DBB8E)
  - Status badge: "Active" (#E8F5F0 bg, #5DBB8E text, 12px)
  - Renewal date: "Renews on {date}" (13px, #999999)
- ✅ Benefits section titled "Your Benefits" (16px semibold, #1A1A1A)
- ✅ 7 benefit rows with green `CheckCircle` icons (16px, #5DBB8E filled):
  - Earn Swap Points on every successful trade
  - Spend Swap Points to reduce purchase prices
  - Donate items for community impact
  - Reduced transaction fee ($0.99 vs $2.99)
  - Priority matching in discovery
  - Early access to new features
  - Priority support when you need help
- ✅ **"Cancel Subscription"** link at bottom (red text #E85D75, 14px)

**TestIDs to verify:**
- `my-subscription-screen`
- `plan-card`
- `active-badge`
- `renewal-date`
- `benefit-0` through `benefit-5`
- `cancel-link`

---

### **TC-09: My Subscription — Free User**

**Objective:** Verify Free tier user sees upgrade CTA instead of cancel link.

**Prerequisites:** User on Free tier.

**Steps:**
1. Navigate to **MySubscription** screen as Free user

**Expected Results:**
- ✅ Plan card:
  - Border: gray 2px (#E0E0E0)
  - Icon: `CrownSimple` (32px, #6B6B6B, regular weight)
  - Plan name: "Free Plan" (20px semibold, #1A1A1A)
  - **No** status badge (Free is not "Active")
  - **No** renewal date
- ✅ **No** benefits section shown
- ✅ **"Upgrade to Kids Club+"** button (green pill #5DBB8E, 48px height)
- ✅ **No** cancel link

**User Action: Tap "Upgrade to Kids Club+"**
- ✅ Navigates to UpgradePlan screen

**TestIDs to verify:**
- `my-subscription-screen`
- `plan-card`
- `upgrade-button`
- (confirm `cancel-link` is NOT present)

---

## 🔍 VISUAL QUALITY CHECKLIST

Check each screen for:

- [ ] **Icon consistency:** Only Phosphor icons used (no Ionicons, no emoji except value prop banner)
- [ ] **Color accuracy:**
  - Free: #E0E0E0
  - Kids Club+: #5DBB8E
  - Error/Cancel: #E85D75
  - Warning (amber): #FFA726
  - Gradient/Highlight: #F0FDF4, #E8F5F0
- [ ] **Button styling:**
  - Primary CTAs: 48-52px height, borderRadius 24-26 (pill), green
  - Secondary actions: text links, 14px, colored text only
  - Subtle shadows on CTAs (elevation: 3)
- [ ] **Text hierarchy:**
  - Main titles: 24-26px bold #1A1A1A
  - Section titles: 18px bold #1A1A1A
  - Body: 15px #1A1A1A
  - Secondary: 15-16px #6B6B6B
  - Tertiary: 13-14px #999999
- [ ] **Spacing consistency:**
  - Margins: 16-20px horizontal padding
  - Gaps: 12px between benefit rows
  - Section spacing: 16-24px vertical margins
- [ ] **Badge styling:**
  - "POPULAR" badge: absolute top -8px, #5DBB8E bg, white text, 10px uppercase
  - "Active" badge: #E8F5F0 bg, #5DBB8E text, 12px, borderRadius 10
- [ ] **Enhanced elements:**
  - Hero gradient background (#F0FDF4)
  - Value prop banner with left border accent
  - Benefits highlight section with subtle background
  - Trust badge footer with check marks
  - Green highlight on Kids Club+ features
- [ ] **Responsive behavior:**
  - All screens scroll properly on small devices (iPhone SE)
  - No text truncation on plan names or prices
  - CTAs remain clickable on all screen sizes
  - Shadows and gradients render correctly

---

## 📊 REGRESSION TEST MATRIX

| User State | Screen | Key Assertion |
|------------|--------|---------------|
| Free | SubscriptionPlans | 2 cards shown (Free + Kids Club+), no "Most Popular" badge |
| Free | PlanComparison | 2 columns, 10 feature rows, correct ✓ or X icons |
| Free | UpgradePlan | Free plan has "Current Plan" chip, Kids Club+ shows "Start 30-day Trial" |
| Free | MySubscription | "Upgrade to Kids Club+" button shown, no cancel link, no benefits section |
| Kids Club+ | SubscriptionPlans | Kids Club+ card has green 2px border, "Start 30-day Trial" button |
| Kids Club+ | MySubscription | "Active" badge shown, "Cancel Subscription" link visible, 7 benefits listed |
| Kids Club+ | CancelSubscription | Warning banner shown, 7 benefits listed |
| Kids Club+ | SubscriptionSuccess | Crown icon (green #5DBB8E, 64px) shown, "Kids Club+ member" title |
| Expired | SubscriptionExpired | Amber warning icon (#FFA726), not red, "Kids Club+" plan name referenced |

---

## ✅ PASS CRITERIA

All tests pass when:

1. **Visual Design:** All 7 screens match MODULE-15.1 design specs (colors, icons, layouts) with 2-tier model
2. **Navigation:** All flows complete without errors (Plans → Payment → Success → Manage → Cancel)
3. **Interactivity:** All CTAs trigger correct navigation
4. **State Handling:** Current plan overlay, disabled downgrade CTAs work correctly, only Free/Kids Club+ shown
5. **Copy Accuracy:** All titles, messages, button labels reference "Kids Club+" (never "Basic" or "Pro")
6. **Icons:** Only Phosphor icons used (Crown green #5DBB8E for Kids Club+, CrownSimple gray for Free)
7. **Benefits Count:** Cancel screen shows 7 benefits, MySubscription shows 7 benefits (matching seeded features)
8. **Responsive:** All screens render correctly on iOS (iPhone SE, 11, 14 Pro) and Android (Pixel 5, Samsung S22)

---

## ❌ FAIL SCENARIOS

Tests fail if:

- Any Ionicons import exists (must be Phosphor only)
- 3 plan cards shown (must be 2: Free + Kids Club+ only)
- Any references to "Basic" or "Pro" tiers appear in screens
- Cancel screen shows 6 benefits instead of 7
- MySubscription shows 6 benefits instead of 7
- Expired screen icon is red instead of amber (#FFA726)
- Kids Club+ icon is wrong color (must be #5DBB8E green, not gold)
- "Keep My Subscription" is not the primary green CTA on cancel screen
- Active badge on MySubscription is not green (#E8F5F0 bg, #5DBB8E text)
- Any compile errors exist (duplicate identifiers, syntax errors)
- Test cases TC-06 and TC-07 reference non-existent tiers

---

## 🛠 DEBUGGING TIPS

**Issue:** Screens not rendering
- Check: Navigation routes added to `types.ts` and `AppNavigator.tsx`
- Check: Imports use `@/` alias correctly
- Run: `npm run typecheck` to verify TypeScript compilation

**Issue:** Icons not showing or wrong icons
- Check: Only `phosphor-react-native` imports (no `@expo/vector-icons`)
- Check: Icon names match Phosphor library (Crown, CheckCircle, X, WarningCircle, CrownSimple)

**Issue:** Colors don't match spec
- Check: `styles` constants use exact hex values (#5DBB8E, #F59E0B, #E85D75, #FFA726, #E0E0E0)
- Check: Pro plan card uses `#1A1A1A` background, not white

**Issue:** Plan detection wrong (shows wrong icon on success)
- Check: `isPro` logic in SubscriptionSuccessScreen uses correct subscription status
- Check: `subscription.status` is 'active' or 'trial' for paid plans

**Issue:** Navigation broken
- Check: `navigation.navigate('ScreenName')` uses exact route name from types.ts
- Check: Route params match type definition (e.g., SubscriptionExpired needs planName + expiredDate)

---

**End of Manual Testing Guide**
