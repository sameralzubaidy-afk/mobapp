# ADMIN-V2-007 Manual Testing Guide

**Task:** Admin Panel UI Theme & Layout Redesign  
**Module:** MODULE-12-ADMIN-V2.md  
**Test Environment:** Next.js Dev Server + Production Supabase  
**Test Devices:** Chrome Browser (Desktop), Safari (Desktop)  
**Date:** {{current_date}}

---

## Pre-Test Setup

### 1. Install Dependencies
```bash
cd p2p-kids-admin
npm install lucide-react
npm install
```

### 2. Start Dev Server
```bash
npm run dev
```
**Expected:** Server starts on `http://localhost:3001`

### 3. Verify Build Success
```bash
npm run build
```
**Expected:** Build completes with no TypeScript or ESLint errors

---

## Test Suite

### TC-001: Design Tokens & CSS Variables

**Objective:** Verify all design tokens are properly defined and accessible

**Steps:**
1. Open dev tools in browser
2. Navigate to `http://localhost:3001`
3. Open Elements → Computed styles
4. Check CSS variables on `:root`

**Expected Results:**
- ✅ `--sidebar-bg` = `#3D1073` (deep purple)
- ✅ `--topbar-bg` = `#FFFFFF` (white)
- ✅ `--content-bg` = `#F2F0FB` (light lavender)
- ✅ `--brand-primary` = `#6C3CE1` (purple)
- ✅ `--brand-accent` = `#FF6B35` (orange)
- ✅ All other variables from `globals.css` are present

**Status:** ☐ Pass ☐ Fail  
**Notes:**

---

### TC-002: Sidebar - Expanded State (Default)

**Objective:** Verify sidebar renders correctly in expanded state

**Steps:**
1. Navigate to `/` (dashboard)
2. Observe left sidebar

**Expected Results:**
- ✅ Sidebar width = 256px
- ✅ Background color = deep purple (#3D1073)
- ✅ "Kids Admin" brand text visible
- ✅ Brand logo (gradient circle) visible
- ✅ Hamburger menu button visible at top-left
- ✅ All navigation items show icons + labels:
  - Dashboard
  - Users
  - Subscriptions
  - SP Wallet
  - Badges
  - Listings
  - Trades
  - Reviews
  - Analytics
  - Payouts
  - Referrals
  - ID Badges
  - Nodes
  - Config (with chevron arrow)
- ✅ Active route (Dashboard) has lighter purple background (#5A2D9C)
- ✅ Sidebar has subtle shadow on right edge

**Status:** ☐ Pass ☐ Fail  
**Notes:**

---

### TC-003: Sidebar - Collapsed State

**Objective:** Verify sidebar collapse functionality

**Steps:**
1. Navigate to `/`
2. Click hamburger menu button (top-left of sidebar)
3. Observe sidebar

**Expected Results:**
- ✅ Sidebar width animates to 64px
- ✅ Brand text "Kids Admin" disappears
- ✅ Navigation labels disappear
- ✅ Chevron arrows disappear
- ✅ Icons remain visible and centered
- ✅ Active route still has lighter purple background
- ✅ Hovering over nav item shows tooltip with label

**Additional Step:**
4. Click hamburger again

**Expected:**
- ✅ Sidebar expands back to 256px
- ✅ All labels reappear
- ✅ Smooth transition animation

**Status:** ☐ Pass ☐ Fail  
**Notes:**

---

### TC-004: Sidebar - Navigation & Active State

**Objective:** Verify navigation links work and active state updates correctly

**Steps:**
1. Click "Users" in sidebar
2. Verify URL changes to `/users`
3. Verify "Users" nav item has active purple background
4. Click "Subscriptions"
5. Verify URL changes to `/subscriptions`
6. Verify "Subscriptions" has active background and "Users" reverts to transparent

**Expected Results:**
- ✅ All sidebar links navigate correctly
- ✅ Only ONE nav item has active background at a time
- ✅ Active state persists on page reload
- ✅ Nested paths (e.g., `/users/123`) keep parent ("Users") active

**Status:** ☐ Pass ☐ Fail  
**Notes:**

---

### TC-005: Sidebar - Hover Effects

**Objective:** Verify interactive hover states

**Steps:**
1. Hover over an inactive nav item (not the current route)

**Expected Results:**
- ✅ Background changes to semi-transparent white (rgba(255,255,255,0.08))
- ✅ Smooth transition
- ✅ Cursor changes to pointer

2. Move mouse away

**Expected:**
- ✅ Background reverts to transparent

**Status:** ☐ Pass ☐ Fail  
**Notes:**

---

### TC-006: Top Navbar - Layout & Positioning

**Objective:** Verify top navbar renders correctly and adjusts to sidebar state

**Steps:**
1. Navigate to `/` with sidebar expanded
2. Observe top navbar

**Expected Results:**
- ✅ Navbar fixed at top of page
- ✅ White background (#FFFFFF)
- ✅ Subtle bottom border (#F0EDF9)
- ✅ Height = 64px
- ✅ Left edge aligns with sidebar right edge (256px from left)
- ✅ Extends to right edge of viewport

3. Collapse sidebar
4. Observe navbar

**Expected:**
- ✅ Navbar left edge adjusts to 64px from left
- ✅ Smooth transition animation

**Status:** ☐ Pass ☐ Fail  
**Notes:**

---

### TC-007: Top Navbar - Search Input

**Objective:** Verify search input functionality

**Steps:**
1. Locate search input on left side of navbar
2. Observe default state

**Expected Results:**
- ✅ Input visible with search icon inside (left side)
- ✅ Placeholder text = "Search…"
- ✅ Background = light lavender (#F2F0FB)
- ✅ Border = subtle (#F0EDF9)
- ✅ Width = 220px
- ✅ Rounded corners (full pill shape)

3. Click into search input
4. Type "test search"

**Expected:**
- ✅ Text appears in input
- ✅ Shadow appears on focus

**Status:** ☐ Pass ☐ Fail  
**Notes:**

---

### TC-008: Top Navbar - Brand Logo (Center)

**Objective:** Verify centered brand logo

**Steps:**
1. Observe center of top navbar

**Expected Results:**
- ✅ Gradient circle logo visible (purple-to-orange gradient)
- ✅ Text "KidsAdmin" next to logo
  - "Kids" in primary text color
  - "Admin" in brand purple
- ✅ Logo+text centered horizontally in navbar

**Status:** ☐ Pass ☐ Fail  
**Notes:**

---

### TC-009: Top Navbar - Notification Bell

**Objective:** Verify notification bell with indicator

**Steps:**
1. Locate notification bell on right side of navbar
2. Observe default state

**Expected Results:**
- ✅ Bell icon visible
- ✅ Circular background (light lavender)
- ✅ Orange dot indicator at top-right of bell (2px × 2px)
- ✅ Hover changes background to darker lavender
- ✅ Cursor changes to pointer

**Status:** ☐ Pass ☐ Fail  
**Notes:**

---

### TC-010: Top Navbar - Admin Profile Button

**Objective:** Verify admin profile display

**Steps:**
1. Locate admin profile button (right side, after bell)
2. Observe contents

**Expected Results:**
- ✅ Profile avatar visible (either image or initial circle)
- ✅ Admin name visible (from logged-in user email prefix)
- ✅ Chevron down icon visible
- ✅ Pill-shaped background (lavender)
- ✅ Hover changes background to darker lavender

3. If no avatar uploaded:

**Expected:**
- ✅ Circle with admin's first initial letter
- ✅ Circle background = brand purple
- ✅ Initial letter = white, bold

**Status:** ☐ Pass ☐ Fail  
**Notes:**

---

### TC-011: Top Navbar - More Options Button

**Objective:** Verify 3-dot more menu button

**Steps:**
1. Locate 3-dot button (far right of navbar)

**Expected Results:**
- ✅ Three horizontal dots icon visible
- ✅ Circular button
- ✅ Hover shows lavender background
- ✅ Cursor changes to pointer

**Status:** ☐ Pass ☐ Fail  
**Notes:**

---

### TC-012: Main Content Area - Background & Layout

**Objective:** Verify main content area styling

**Steps:**
1. Navigate to `/`
2. Observe main content area (right of sidebar, below navbar)

**Expected Results:**
- ✅ Background = light lavender/gray (#F2F0FB)
- ✅ Content starts 256px from left (sidebar width)
- ✅ Content starts 64px from top (navbar height)
- ✅ 24px padding around content
- ✅ Content adjusts left margin when sidebar collapses

**Status:** ☐ Pass ☐ Fail  
**Notes:**

---

### TC-013: MetricCard Component - Visual & Content

**Objective:** Verify MetricCard renders with correct theme styling

**Steps:**
1. Create a test page with MetricCard:
```tsx
import { MetricCard } from '@/components/ui/MetricCard';
import { Users } from 'lucide-react';

<MetricCard
  label="Total Users"
  value="1,234"
  subtitle="Active now"
  icon={<Users size={18} />}
  color="purple"
  trend="+12%"
  trendDir="up"
/>
```

2. Navigate to test page

**Expected Results:**
- ✅ White card with subtle shadow
- ✅ Subtle border (#F0EDF9)
- ✅ Rounded corners (12px)
- ✅ 24px padding
- ✅ Icon in colored rounded square (purple bg, darker purple icon)
- ✅ Label "TOTAL USERS" in uppercase, purple, small, bold
- ✅ Value "1,234" large (3xl), bold, dark primary text
- ✅ Trend "+12%" in green
- ✅ Subtitle "Active now" in secondary gray text
- ✅ Hover shows stronger shadow

**Status:** ☐ Pass ☐ Fail  
**Notes:**

---

### TC-014: MetricCard Component - Color Variants

**Objective:** Verify all icon color variants work

**Steps:**
1. Render 4 MetricCards with different colors:
   - `color="purple"`
   - `color="orange"`
   - `color="green"`
   - `color="blue"`

**Expected Results:**
- ✅ Each card has matching icon wrapper background (light tint)
- ✅ Each card has matching icon color (solid color)
- ✅ Each card label uses the same color as icon
- ✅ Colors match design tokens from theme.ts

**Status:** ☐ Pass ☐ Fail  
**Notes:**

---

### TC-015: MetricCard Component - Trend Directions

**Objective:** Verify trend color logic

**Steps:**
1. Render MetricCards with different trend directions:
   - `trendDir="up"` → green
   - `trendDir="down"` → red
   - `trendDir="neutral"` → gray

**Expected Results:**
- ✅ Up trend = green color (#28A745)
- ✅ Down trend = red color (#E53935)
- ✅ Neutral trend = muted gray (#9B97B5)

**Status:** ☐ Pass ☐ Fail  
**Notes:**

---

### TC-016: ChartCard Component - Basic Rendering

**Objective:** Verify ChartCard renders correctly

**Steps:**
1. Create test page with ChartCard:
```tsx
import { ChartCard } from '@/components/ui/ChartCard';

<ChartCard title="Revenue Chart">
  <div>Chart Content Here</div>
</ChartCard>
```

2. Navigate to test page

**Expected Results:**
- ✅ White card with shadow
- ✅ Rounded corners
- ✅ Title "Revenue Chart" at top-left, bold, dark text
- ✅ Chart container height = 220px (default)
- ✅ 24px padding
- ✅ Hover shows stronger shadow

**Status:** ☐ Pass ☐ Fail  
**Notes:**

---

### TC-017: ChartCard Component - Period Filter

**Objective:** Verify period filter dropdown

**Steps:**
1. Render ChartCard with `showPeriodFilter={true}`
2. Observe top-right of card

**Expected Results:**
- ✅ Period button visible with text "This week" (default)
- ✅ Chevron down icon visible

3. Click period button

**Expected:**
- ✅ Dropdown menu opens below button
- ✅ White background, shadow, rounded corners
- ✅ Options: "Today", "This week", "This month", "This year"
- ✅ Current selection (This week) has purple text + lavender bg
- ✅ Other options have gray text

4. Click "This month"

**Expected:**
- ✅ Dropdown closes
- ✅ Button text updates to "This month"
- ✅ `onPeriodChange` callback fires with "This month"

**Status:** ☐ Pass ☐ Fail  
**Notes:**

---

### TC-018: Responsive Behavior - Sidebar Collapse UX

**Objective:** Verify smooth transitions and no layout jumps

**Steps:**
1. Navigate to any page
2. Toggle sidebar collapse 5 times rapidly

**Expected Results:**
- ✅ No layout jumps or flicker
- ✅ Smooth animation (300ms)
- ✅ Main content shifts smoothly
- ✅ Top navbar adjusts position smoothly
- ✅ No horizontal scrollbar appears

**Status:** ☐ Pass ☐ Fail  
**Notes:**

---

### TC-019: Scrollbar Styling

**Objective:** Verify custom scrollbar design

**Steps:**
1. Navigate to a page with long content (scroll required)
2. Observe scrollbar in main content area
3. Observe scrollbar in sidebar (if nav items overflow)

**Expected Results:**
- ✅ Scrollbar width = 4px (thin)
- ✅ Track background = transparent
- ✅ Thumb = muted purple (#C4A8E8)
- ✅ Thumb has rounded ends (pill shape)

**Status:** ☐ Pass ☐ Fail  
**Notes:**

---

### TC-020: Font Loading & Typography

**Objective:** Verify Inter font loads correctly

**Steps:**
1. Open dev tools → Network tab
2. Hard refresh page
3. Filter by "font"

**Expected Results:**
- ✅ Inter font files load from Google Fonts
- ✅ No font loading errors
- ✅ All text renders in Inter font family
- ✅ Fallback to system-ui if Inter fails

4. Inspect text elements

**Expected Typography:**
- ✅ Headings use font-weight 600 or 700
- ✅ Body text uses font-weight 400
- ✅ Labels use font-weight 500
- ✅ All text has -webkit-font-smoothing: antialiased

**Status:** ☐ Pass ☐ Fail  
**Notes:**

---

### TC-021: Auth Flow Integration

**Objective:** Verify AdminShell only renders for authenticated admins

**Steps:**
1. Clear browser cookies/storage
2. Navigate to `/`

**Expected Results:**
- ✅ AdminShell checks auth
- ✅ If not authenticated → redirect to `/auth/login`
- ✅ Login page shows without sidebar/topbar
- ✅ After login → redirect to dashboard with full admin shell

**Status:** ☐ Pass ☐ Fail  
**Notes:**

---

### TC-022: Cross-Page Consistency

**Objective:** Verify theme applies consistently across all admin pages

**Steps:**
1. Visit each admin page:
   - `/` (Dashboard)
   - `/users`
   - `/subscriptions`
   - `/sp-wallet`
   - `/badges`
   - `/config`
   - `/nodes`
   - `/analytics`

**Expected Results:**
- ✅ Sidebar remains consistent on all pages
- ✅ Top navbar remains consistent
- ✅ Content background (lavender) consistent
- ✅ Active nav state updates correctly for each route
- ✅ No theme color mismatches

**Status:** ☐ Pass ☐ Fail  
**Notes:**

---

### TC-023: Build Production Verification

**Objective:** Verify theme works in production build

**Steps:**
```bash
npm run build
npm run start
```

**Expected Results:**
- ✅ Build succeeds with no errors
- ✅ Production server starts
- ✅ Navigate to `http://localhost:3000` (or configured port)
- ✅ All theme colors render correctly
- ✅ No missing styles or broken layouts
- ✅ Performance is smooth (no lag on collapse/expand)

**Status:** ☐ Pass ☐ Fail  
**Notes:**

---

## Test Summary

**Total Test Cases:** 23  
**Passed:** _____  
**Failed:** _____  
**Blocked:** _____  

### Critical Issues Found:
-

### Non-Critical Issues Found:
-

### Recommendations:
-

---

## Sign-Off

**Tested By:** _________________  
**Date:** _________________  
**Approved By:** _________________  
**Date:** _________________
