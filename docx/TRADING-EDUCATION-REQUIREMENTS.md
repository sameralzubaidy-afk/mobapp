# Trading Education ("How It Works") — Complete Requirements Document

**Project:** Kids P2P Marketplace  
**Feature:** Configurable Trading Education & SP Calculator  
**Version:** 1.0  
**Date:** April 20, 2026  
**Owner:** @sameralzubaidy-afk  
**Target Release:** Week 7-8 (MVP Track 4)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [UX Decisions & Competitor Benchmarks](#ux-decisions--competitor-benchmarks)
3. [User Stories](#user-stories)
4. [Database Schema Changes](#database-schema-changes)
5. [Backend Functions (RPCs & Services)](#backend-functions-rpcs--services)
6. [Admin Portal Architecture](#admin-portal-architecture)
7. [Complete Function Reference](#complete-function-reference)
8. [Component Specifications](#component-specifications)
9. [Performance Requirements](#performance-requirements)
10. [Accessibility Requirements](#accessibility-requirements)
11. [Testing Requirements](#testing-requirements)
12. [Acceptance Criteria](#acceptance-criteria)
13. [Out of Scope (Post-MVP)](#out-of-scope-post-mvp)
14. [Implementation Checklist](#implementation-checklist)

---

## Executive Summary

### **Problem Statement**

Current user onboarding & education has critical gaps:
- ❌ No explanation of Swap Points (SP) system → users confused
- ❌ No trading education → parents don't understand safety measures
- ❌ No contextual help → users stuck during first listing/purchase
- ❌ No SP calculator → sellers can't estimate earnings, buyers can't plan spending
- ❌ Content is hardcoded → can't update education without app release
- ❌ No onboarding flow → new users dropped into app without guidance

### **Solution Overview**

**Scope:**
- ✅ "How It Works" onboarding carousel (first-time users)
- ✅ Persistent Help section (accessible anytime from menu)
- ✅ Configurable content sections (admin-editable)
- ✅ Interactive SP calculator (3 placements: education, sell tab, checkout)
- ✅ Category-aware SP calculations (different rates per category)
- ✅ Bonus category education (visual badges for categories earning >1.10x)
- ✅ Dynamic example scenarios (admin sets prices, app calculates SP math)
- ✅ Safety & Trust education section
- ✅ Publish/draft system for content versioning
- ✅ Analytics (track views, completion rate, time spent)

**Phase 1 (MVP — Weeks 7-8):**
- ✅ 4 core content sections: SP Definition, Earning SP, Spending SP, Safety
- ✅ Onboarding carousel (swipeable screens, skippable)
- ✅ Help screen (always accessible from Settings)
- ✅ SP calculator with category selection (enter item price + category → see SP earned/usable)
- ✅ Bonus category display (⭐ badge for categories earning >1.10x)
- ✅ Progressive disclosure UX (show SP amounts, hide technical multipliers)
- ✅ Admin CMS: section-based editor (title, body, image, order)
- ✅ Publish/draft workflow for content changes
- ✅ Contextual prompts (before first listing, before first purchase)
- ✅ View analytics (completion rate, drop-off points)

**Phase 2 (Post-MVP):**
- Video tutorials (embed from YouTube/Vimeo)
- Quiz/gamification (test understanding, unlock badge)
- Personalized content (buyers vs sellers)
- Multi-language support
- Trade simulator (walk through mock transaction)
- Push notification reminders ("Learn about Swap Points")

### **Success Metrics**

| Metric | Current | Target (MVP) |
|--------|---------|--------------|
| New users who understand SP | Unknown | > 80% (post-onboarding survey) |
| SP calculator usage | 0 uses | > 50% of sellers use it |
| Onboarding completion rate | 0% (no onboarding) | > 70% |
| Help section views | 0 | Track post-launch |
| Support tickets re: "What is SP?" | Unknown | < 10% of total tickets |

---

## UX Decisions & Competitor Benchmarks

### **1. Placement: Multi-Context**
**Decision:** Onboarding + Help section + contextual prompts

**Placements:**
| Context | When | Format |
|---------|------|--------|
| Onboarding | First app open | Carousel (5 screens) |
| Help section | Anytime from Settings → Help | Single scrollable page |
| Contextual | Before first listing | Modal: "How SP works for sellers" |
| Contextual | Before first purchase | Modal: "Use SP to save money" |
| Sell tab | Always visible | SP calculator widget |
| Checkout | SP toggle tapped | SP calculator + explanation |

---

### **2. Onboarding Structure: Swipeable Carousel**
**Decision:** 5-screen carousel, skippable, progress dots

**Screens:**
1. **Welcome** — "Kids P2P Marketplace" + tagline
2. **What is SP?** — Definition + icon
3. **Earn SP** — "Sell items → earn 80% in SP"
4. **Spend SP** — "Use up to 50% of item price"
5. **Safety First** — Parent supervision + safe meetups

**UI Pattern:**
```
┌─────────────────────────────────────┐
│  Screen 2/5                         │
│  ● ○ ○ ○ ○  (progress dots)          │
│                                     │
│  [Large illustration]               │
│                                     │
│  What are Swap Points?              │
│  Our fun currency! Earn points by   │
│  selling items, spend them on new   │
│  treasures. It's like magic money!  │
│                                     │
│                                     │
│  [Skip]              [Next →]       │
└─────────────────────────────────────┘
```

**Benchmark:**
| App | Onboarding Style |
|-----|-----------------|
| Airbnb | Carousel (5 screens, skippable) |
| Duolingo | Carousel (3 screens, skippable) |
| Robinhood | Carousel (7 screens, animated) |
| **Kids Marketplace** | **Carousel (5 screens, skippable, illustrated)** |

---

### **3. Help Section: Single Scrollable Page**
**Decision:** All sections in one page, accordion style

**Sections:**
1. **What are Swap Points?** (always expanded by default)
2. **How to Earn SP** (tap to expand)
3. **How to Spend SP** (tap to expand)
4. **SP Calculator** (interactive widget, always visible)
5. **Safety & Trust** (tap to expand)

**Accessible From:** Settings → Help → How Trading Works

---

### **4. Content Topics: Focus on SP + Safety**
**Decision:** 4 core sections (confirmed by user)

**Topics Included:**
- ✅ What are Swap Points (SP definition)
- ✅ How to earn SP (sell items → earn 80% in SP)
- ✅ How to spend SP (50% cap rule, cash fee still applies)
- ✅ Example trade calculations for SP
- ✅ Safety & Trust (parent supervision, safe meetups, reporting)

**Topics Excluded (Post-MVP):**
- ❌ How to list items (covered in contextual tooltips)
- ❌ How to search and buy (intuitive enough)
- ❌ Shipping vs local pickup (not core to SP understanding)
- ❌ Payment methods (covered in checkout)
- ❌ Fees & pricing (covered in SP calculations)

---

### **5. SP Explanation: Detailed + Interactive**
**Decision:** Explain rules + provide calculator

**Content Structure:**
```
What are Swap Points?
━━━━━━━━━━━━━━━━━━━
Swap Points (SP) are our special currency. 
When you sell items, you earn SP. Use SP to 
save money on future purchases!

How much SP do I earn?
━━━━━━━━━━━━━━━━━━━
You earn 80% of the sale price in SP.

Example: Sell a $20 toy → Earn 16 SP

How can I use SP?
━━━━━━━━━━━━━━━━━━━
Use up to 50% of an item's price in SP.
You still pay the cash service fee.

Example: Buy a $30 book
→ Use 15 SP (50% of $30)
→ Pay $15 cash + $1.50 fee

Try the Calculator ↓
```

---

### **6. Interactive SP Calculator**
**Decision:** Calculator placed in 3 locations with category-aware calculations

**Locations:**
1. **Help Section** — Always visible widget with category dropdown
2. **Sell Tab** — "Estimate your SP earnings" (auto-fills category from listing)
3. **Checkout** — "Calculate SP usage" (auto-fills category from item)

**Calculator UI:**
```
┌─────────────────────────────────────┐
│  💰 SP Calculator                   │
├─────────────────────────────────────┤
│  Category: [Toys & Games ▼]         │
│  Item Price: $ ____                 │
│                                     │
│  ━━━ If you SELL this item ━━━      │
│  You'll earn: 22 SP ⭐              │
│                                     │
│  ━━━ If you BUY this item ━━━       │
│  You can use: up to 14 SP (70%)     │
│  You'll pay: $6 cash + fee          │
└─────────────────────────────────────┘
```

**Calculations (Category-Aware):**
- **Earn SP:** `item_price * category.sp_earning_multiplier` (range: 1.05-1.40x)
- **Max SP usable:** `item_price * (category.sp_spending_cap_percent / 100)` (range: 50-80%)
- **Cash paid:** `item_price - sp_used + fee`
- **Visual indicator:** Show ⭐ if category earning multiplier > 1.10x

---

### **7. Examples: Dynamic & Configurable**
**Decision:** Admin sets example prices, app calculates SP based on category

**Admin CMS:**
```
Example Trade Scenario
━━━━━━━━━━━━━━━━━━━━
Item Name: LEGO Set
Item Price: $40
Category: Toys & Games (1.10x earn, 70% spend)

[Auto-calculated results shown to users:]
→ Sell: Earn 44 SP (1.10x)
→ Buy: Use up to 28 SP (70%), pay $12 cash + fee
```

**Rationale:** Admin can update prices AND categories to match current marketplace trends without developer intervention

---

### **8. Category-Based SP Rates**
**Decision:** Different earning and spending rates per category

**User Communication Strategy:**
| Approach | Method |
|----------|--------|
| **Don't Explain, Just Show** | Display actual SP amounts, not multipliers |
| **Progressive Disclosure** | Simple upfront, details in Help for interested users |
| **Visual Indicators** | ⭐ badge for bonus categories (earning >1.10x) |
| **Examples Over Math** | "Earn 39 SP" not "1.30x multiplier" |

**Category Rate Examples (Admin Configured):**
| Category | Earn Multiplier | Spend Cap | Badge |
|----------|----------------|-----------|-------|
| Books | 1.30x | 75% | ⭐ |
| Toys | 1.10x | 70% | — |
| Baby Gear | 1.15x | 60% | ⭐ |
| Electronics | 1.05x | 50% | — |

**User Experience:**
- **Listing:** "List this book for $30 → Earn 39 SP ⭐"
- **Browsing:** Categories with bonus badge show ⭐ icon
- **Help Section:** "Some categories earn bonus SP! Check the ⭐ badge"
- **Progressive Detail:** Help section shows list of bonus categories with examples

**Legal & Economic Rationale:**
- Variable earning (1.05-1.40x) avoids "1 SP = $1" perception
- Spending caps (50-80%) maintain 70/30 rule (minimum 20-30% cash)
- Admin control allows balancing marketplace supply/demand per category

---

### **9. Admin CMS: Section-Based Editor**
**Decision:** Structured sections (not free-form rich text)

**Section Fields:**
| Field | Type | Required | Max Length |
|-------|------|----------|------------|
| title | TEXT | Yes | 100 chars |
| body | TEXT | Yes | 1000 chars |
| image_url | TEXT | No | 500 chars |
| display_order | INT | Yes | Auto-generated |
| is_published | BOOLEAN | Yes | Default false |

**Why Not Rich Text?**
- Safer (no XSS attacks)
- Consistent design (can't break layout)
- Easier to implement
- Mobile-friendly (no complex HTML rendering)

---

### **10. Content Versioning: Publish/Draft**
**Decision:** Draft → Preview → Publish workflow

**States:**
- **Draft:** Admin can edit freely, not visible to users
- **Preview:** Admin can view as user would see it
- **Published:** Live to all users

**Admin Workflow:**
```
1. Admin edits section (auto-saves as draft)
2. Admin clicks "Preview" → opens mobile preview
3. Admin clicks "Publish" → content goes live
4. Old version archived (can rollback if needed)
```

---

### **11. Safety Section Content**
**Decision:** Dedicated section with parent-focused messaging

**Content:**
```
Safety & Trust
━━━━━━━━━━━━━━━━━━━
🛡️ Parent Supervision
All trades should involve parent/guardian 
oversight. Review items before purchasing.

📍 Safe Meeting Locations
Meet in public places: libraries, coffee 
shops, police station parking lots.

🚨 Report Issues
Tap the flag icon on any listing to report 
suspicious activity. We review reports 
within 24 hours.

🔒 Privacy Protection
We never share your child's personal info. 
All communication through app only.

❓ Questions?
Contact support@kidsmarketplace.com
```

---

### **12. Trigger Rules: Smart Prompting**
**Decision:** Contextual prompts at key moments

**Triggers:**
| Trigger | Modal Content | Dismissible |
|---------|---------------|-------------|
| First app open | Full onboarding carousel | Yes (skippable) |
| Before first listing | "How SP works for sellers" | Yes (1-time) |
| Before first purchase | "Save with SP" | Yes (1-time) |
| SP toggle in checkout | SP calculator + explanation | Yes (always) |
| Anytime | Settings → Help → How Trading Works | N/A |

**Smart Logic:**
- If user completes onboarding → don't show again
- If user skips onboarding → show contextual prompts
- If user dismisses prompt 3x → stop showing

---

### **13. Analytics Tracking**
**Decision:** Track engagement to improve content

**Metrics:**
| Metric | Purpose |
|--------|---------|
| Onboarding completion rate | How many users finish carousel |
| Drop-off screen | Which screen users skip most |
| Help section views | How many users access Help |
| Time spent per section | Which sections are read fully |
| SP calculator usage | How many users interact with calculator |
| Contextual prompt dismissals | Are prompts helpful or annoying? |

**Implementation:** Supabase analytics table + simple dashboard

---

## User Stories

### **US-401: Onboarding Carousel (First-Time User)**
**As a** new user opening the app for the first time  
**I want** to see a quick introduction to how the marketplace works  
**So that** I understand Swap Points and safety rules before trading

**Acceptance Criteria:**
- First app open shows 5-screen carousel
- Swipe left/right to navigate
- Progress dots show current screen (2/5)
- "Skip" button on every screen
- "Get Started" on final screen → navigate to home
- Carousel not shown again after completion or skip

---

### **US-402: Access Help Anytime**
**As a** user who forgot how SP works  
**I want** to re-read the explanation  
**So that** I can make informed trading decisions

**Acceptance Criteria:**
- Go to Settings → Help → How Trading Works
- See all sections (SP definition, earn, spend, safety)
- Sections expandable/collapsible (accordion)
- SP calculator always visible
- Content loads in < 1 second

---

### **US-403: SP Calculator in Help**
**As a** seller planning to list an item  
**I want** to calculate how much SP I'll earn for different categories  
**So that** I can decide which category to list in

**Acceptance Criteria:**
- Open Help → How Trading Works
- See SP Calculator widget
- Select category: "Toys & Games"
- Enter item price: $25
- See calculated result: "Earn 27.50 SP" (if 1.10x multiplier)
- See ⭐ badge if category has bonus earning (>1.10x)
- See buy calculation: "Use up to 17.50 SP (70%), pay $7.50 + fee"
- Change category to "Books" (1.30x multiplier)
- See updated result: "Earn 32.50 SP ⭐"

---

### **US-404: Contextual Prompt Before First Listing**
**As a** new seller creating my first listing  
**I want** a quick reminder about SP earnings  
**So that** I understand what I'll get when item sells

**Acceptance Criteria:**
- Tap "Create Listing" for the first time
- Modal appears: "Sell items, earn Swap Points!"
- Shows: "Earn SP based on your category - some categories earn bonus SP! ⭐"
- Shows example: "Books: Earn 39 SP on $30 item ⭐"
- "Got it" button closes modal
- Never shown again after dismissal

---

### **US-405: Contextual Prompt Before First Purchase**
**As a** new buyer about to make first purchase  
**I want** to understand how to use SP  
**So that** I can save money

**Acceptance Criteria:**
- Tap "Buy Now" for first time
- Modal: "Save with Swap Points!"
- Shows: "Use up to 50% of price in SP"
- Links to full help: "Learn more"
- "Continue" proceeds to checkout
- Not shown again

---

### **US-406: SP Calculator in Checkout**
**As a** buyer with SP balance  
**I want** to see how much I can save  
**So that** I decide how much SP to use

**Acceptance Criteria:**
- In checkout, tap SP toggle
- Calculator appears below toggle
- Shows current SP balance: 25 SP
- Shows item price: $30
- Shows item category: "Toys" (70% spending cap)
- Shows "Use up to 21 SP (70% cap)" 
- Slider to adjust SP usage (0-21 SP)
- Real-time update of cash payment
- If item is in "Books" category (75% cap): shows "Use up to 22.50 SP (75% cap)"

---

### **US-407: Admin Edit Education Content**
**As an** admin  
**I want** to update the SP explanation text  
**So that** I can clarify confusing parts based on user feedback

**Acceptance Criteria:**
- Login to admin portal
- Navigate to Content Management → Education
- Click "Edit" on "What are Swap Points?" section
- Change body text in form
- Click "Save Draft" → changes saved, not published yet
- Click "Preview" → see content as users would
- Click "Publish" → content goes live immediately

---

### **US-408: Admin Create Example Scenario**
**As an** admin  
**I want** to add a new trade example  
**So that** users see realistic scenarios

**Acceptance Criteria:**
- Admin portal → Education → Examples
- Click "Add Example"
- Enter: Item name "Bicycle", Price $100
- App auto-calculates: Sell → 80 SP, Buy → use 50 SP max
- Save → example appears in Help section
- Users see: "Sell a $100 bicycle → earn 80 SP"

---

### **US-409: Admin Preview Before Publish**
**As an** admin  
**I want** to preview content changes before publishing  
**So that** I catch typos or errors

**Acceptance Criteria:**
- Edit section, change text
- Click "Preview" button
- Opens mobile preview (simulated phone screen)
- Shows exactly what users will see
- Click "Back to Edit" → return to form
- No changes published yet

---

### **US-410: View Analytics**
**As an** admin  
**I want** to see how many users view the Help section  
**So that** I know if education content is being used

**Acceptance Criteria:**
- Admin portal → Analytics → Education
- See metrics: Total views, Avg time spent, Completion rate
- See drop-off points: "80% drop at screen 3"
- See SP calculator usage: "45% of users tried calculator"
- Data refreshed daily

---

## Database Schema Changes

### **Migration 1: Create education_sections Table**

**File:** `supabase/migrations/20260420000005_create_education_sections.sql`

```sql
-- ================================================================
-- Migration: Create education_sections Table
-- Date: 2026-04-20
-- Description: Store configurable education content sections
-- ================================================================

CREATE TABLE IF NOT EXISTS public.education_sections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL CHECK (LENGTH(title) BETWEEN 3 AND 100),
  body            TEXT NOT NULL CHECK (LENGTH(body) BETWEEN 10 AND 2000),
  image_url       TEXT CHECK (LENGTH(image_url) <= 500),
  display_order   INT NOT NULL DEFAULT 0,
  section_type    TEXT NOT NULL DEFAULT 'general'
    CHECK (section_type IN ('general', 'sp_definition', 'sp_earning', 'sp_spending', 'safety', 'example')),
  is_published    BOOLEAN NOT NULL DEFAULT false,
  published_at    TIMESTAMPTZ,
  published_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_section_type UNIQUE (section_type, is_published)
);

-- RLS
ALTER TABLE public.education_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published sections"
  ON public.education_sections
  FOR SELECT
  USING (is_published = true);

CREATE POLICY "Admin can manage all sections"
  ON public.education_sections
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_education_sections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER education_sections_updated_at
  BEFORE UPDATE ON public.education_sections
  FOR EACH ROW EXECUTE FUNCTION update_education_sections_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_education_sections_published
  ON education_sections(display_order)
  WHERE is_published = true;

CREATE INDEX IF NOT EXISTS idx_education_sections_type
  ON education_sections(section_type, is_published);

COMMENT ON TABLE public.education_sections IS 'Configurable education content sections for "How It Works"';
```

---

### **Migration 2: Create education_examples Table**

```sql
-- ================================================================
-- Migration: Create education_examples Table
-- Description: Store trade scenario examples with auto-calculated SP
-- ================================================================

CREATE TABLE IF NOT EXISTS public.education_examples (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name       TEXT NOT NULL CHECK (LENGTH(item_name) BETWEEN 3 AND 100),
  item_price      DECIMAL(10,2) NOT NULL CHECK (item_price > 0 AND item_price <= 10000),
  category_id     UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  display_order   INT NOT NULL DEFAULT 0,
  is_published    BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.education_examples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published examples"
  ON public.education_examples
  FOR SELECT
  USING (is_published = true);

CREATE POLICY "Admin can manage examples"
  ON public.education_examples
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Auto-update updated_at
CREATE TRIGGER education_examples_updated_at
  BEFORE UPDATE ON public.education_examples
  FOR EACH ROW EXECUTE FUNCTION update_education_sections_updated_at();

-- Index
CREATE INDEX IF NOT EXISTS idx_education_examples_published
  ON education_examples(display_order)
  WHERE is_published = true;

COMMENT ON TABLE public.education_examples IS 'Trade scenario examples with admin-set prices, SP auto-calculated';
```

---

### **Migration 3: Create education_analytics Table**

```sql
-- ================================================================
-- Migration: Create education_analytics Table
-- Description: Track user engagement with education content
-- ================================================================

CREATE TABLE IF NOT EXISTS public.education_analytics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL
    CHECK (event_type IN ('onboarding_start', 'onboarding_complete', 'onboarding_skip', 
                          'help_view', 'section_expand', 'calculator_use', 
                          'contextual_prompt_view', 'contextual_prompt_dismiss')),
  event_data      JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.education_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own analytics"
  ON public.education_analytics
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin can view all analytics"
  ON public.education_analytics
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Indexes for aggregation queries
CREATE INDEX IF NOT EXISTS idx_education_analytics_event_type
  ON education_analytics(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_education_analytics_user
  ON education_analytics(user_id, created_at DESC);

COMMENT ON TABLE public.education_analytics IS 'User engagement tracking for education content';
```

---

### **Migration 4: Seed Initial Content**

```sql
-- ================================================================
-- Seed Initial Education Content
-- ================================================================

INSERT INTO public.education_sections (section_type, title, body, display_order, is_published)
VALUES
  ('sp_definition', 
   'What are Swap Points?', 
   'Swap Points (SP) are our special currency! When you sell items, you earn SP. Use SP to save money on future purchases. It''s like earning magic money for trading!',
   1, 
   true),
  
  ('sp_earning', 
   'How to Earn SP', 
   'Every time you sell an item, you earn SP based on the category. Most items earn around 1.10 SP per dollar - some bonus categories earn even more! Look for the ⭐ badge on bonus categories.',
   2, 
   true),
  
  ('sp_spending', 
   'How to Spend SP', 
   'Use your SP to save money! Most categories let you use up to 70% of the item price in SP - some categories allow even more! Check the category details when shopping. Note: You still pay the small service fee on the cash portion.',
   3, 
   true),
  
  ('safety', 
   'Safety & Trust', 
   '🛡️ Parent Supervision: All trades should involve parent/guardian oversight.\n\n📍 Safe Meetings: Meet in public places like libraries or coffee shops.\n\n🚨 Report Issues: Tap the flag icon to report suspicious activity.\n\n🔒 Privacy: We never share personal info.',
   4, 
   true);

-- Insert example scenarios (category_id references will be set based on actual category IDs)
-- Admin will update these via CMS to link to actual categories
INSERT INTO public.education_examples (item_name, item_price, category_id, display_order, is_published)
VALUES
  ('LEGO Set', 20.00, NULL, 1, true),  -- Admin sets category via CMS
  ('Kids Book', 10.00, NULL, 2, true), -- Admin sets category via CMS
  ('Toy Car', 15.00, NULL, 3, true);   -- Admin sets category via CMS
```

---

## Backend Functions (RPCs & Services)

### **Content Management**

#### `getPublishedSections(): Promise<EducationSection[]>`
- Returns all published sections ordered by `display_order`
- Used by mobile app to load Help content
- Cached for 5 minutes (invalidate on publish)

#### `getSectionByType(type: string): Promise<EducationSection | null>`
- Returns specific section by `section_type`
- Used for contextual prompts (e.g., fetch 'sp_earning' before first listing)

#### `updateSection(id: string, updates: Partial<EducationSection>): Promise<EducationSection>`
- Updates section fields (admin only)
- Sets `updated_at` timestamp
- Does NOT publish automatically (stays draft)

#### `publishSection(id: string, adminUserId: string): Promise<void>`
- Sets `is_published = true`
- Sets `published_at = now()`
- Sets `published_by = adminUserId`
- Invalidates cache
- **Business Rule:** Only one published section per `section_type` (constraint enforced)

#### `unpublishSection(id: string): Promise<void>`
- Sets `is_published = false`
- Used for rolling back live content

---

### **Example Scenarios**

#### `getPublishedExamples(): Promise<EducationExample[]>`
- Returns all published examples ordered by `display_order`
- Each example includes calculated SP values (computed on read)

#### `calculateExampleSP(price: number, categoryId: string): { earn_sp: number; max_use_sp: number; cash_paid: number; fee: number; is_bonus: boolean }`
- Fetches category's SP rates (earning multiplier, spending cap)
- Earn SP: `price * category.sp_earning_multiplier`
- Max use SP: `price * (category.sp_spending_cap_percent / 100)`
- Cash paid: `price - max_use_sp`
- Fee: `cash_paid * 0.10`
- is_bonus: `true` if `sp_earning_multiplier > 1.10`
- Returns all values for display

#### `createExample(itemName: string, price: number): Promise<EducationExample>`
- Admin creates new example
- Starts as draft (`is_published = false`)

#### `deleteExample(id: string): Promise<void>`
- Admin deletes example
- Only allowed if `is_published = false` (can't delete live content)

---

### **SP Calculator**

#### `calculateSP(itemPrice: number, categoryId: string, mode: 'sell' | 'buy', spToUse?: number): SPCalculation`
- Fetches category's `sp_earning_multiplier` and `sp_spending_cap_percent`
- **Sell mode:** Returns SP earned = `itemPrice * sp_earning_multiplier`
- **Buy mode:** Returns max SP usable = `itemPrice * (sp_spending_cap_percent / 100)`, cash paid, fee
- If `spToUse` provided in buy mode: calculates exact cash + fee
- Returns `is_bonus_category` flag if earning multiplier > 1.10

**Return Type:**
```typescript
interface SPCalculation {
  item_price: number;
  category_id: string;
  category_name: string;
  is_bonus_category: boolean;  // True if sp_earning_multiplier > 1.10
  sp_earned?: number;           // Sell mode only
  max_sp_usable?: number;       // Buy mode only
  sp_spending_cap_percent?: number; // Buy mode only
  sp_used?: number;             // Buy mode only (if spToUse provided)
  cash_paid?: number;           // Buy mode only
  fee?: number;                 // Buy mode only (10% of cash)
  total_cost?: number;          // Buy mode: cash + fee
}
```

#### `getBonusCategories(): Promise<BonusCategory[]>`
- Returns categories where `sp_earning_multiplier > 1.10`
- Includes category name, icon, bonus badge icon, earning multiplier, spending cap
- Orders by `sp_earning_multiplier DESC`
- Used to display bonus categories in Help section

**Return Type:**
```typescript
interface BonusCategory {
  id: string;
  name: string;
  icon: string;
  bonus_badge_icon_url: string;
  sp_earning_multiplier: number;
  sp_spending_cap_percent: number;
}
```

---

### **Analytics**

#### `trackEducationEvent(userId: string, eventType: string, eventData?: any): Promise<void>`
- Inserts event into `education_analytics` table
- Called from mobile app on key actions

**Event Types:**
- `onboarding_start`
- `onboarding_complete`
- `onboarding_skip`
- `help_view`
- `section_expand` (event_data: `{ section_type }`)
- `calculator_use` (event_data: `{ item_price, mode }`)
- `contextual_prompt_view` (event_data: `{ prompt_type }`)
- `contextual_prompt_dismiss`

#### `getEducationAnalytics(startDate: Date, endDate: Date): Promise<EducationAnalytics>`
- Returns aggregated metrics for admin dashboard
- Completion rate, drop-off points, avg time spent, calculator usage

---

## Admin Portal Architecture

### **Page: EducationContentPage**

**Path:** `admin-portal/src/pages/EducationContentPage.tsx`

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Admin > Content Management > Education          │
├─────────────────────────────────────────────────┤
│                                                 │
│  Sections (4)  │  Examples (3)  │  Analytics   │
│  ════════════════════════════════════════════   │
│                                                 │
│  [+ Add Section]              [Preview Mobile]  │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ SectionTable                           │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Tabs:**
1. **Sections** — Edit core education content
2. **Examples** — Manage trade scenarios
3. **Analytics** — View engagement metrics

---

### **Component: SectionTable**

**Columns:**
| Column | Width | Content |
|--------|-------|---------|
| Title | 300px | Section title |
| Type | 150px | sp_definition, sp_earning, etc. |
| Status | 120px | Published / Draft badge |
| Updated | 150px | Last edit timestamp |
| Actions | 150px | Edit, Preview, Publish buttons |

**Row Example:**
```
What are Swap Points? | SP Definition | ✅ Published | 2h ago | [Edit] [Preview]
```

---

### **Component: SectionForm (Modal)**

```
┌─────────────────────────────────────┐
│  Edit Section               [✕]     │
├─────────────────────────────────────┤
│  Type                               │
│  ┌──────────────────────────────┐   │
│  │ SP Definition            ▼   │   │
│  └──────────────────────────────┘   │
│                                     │
│  Title                              │
│  ┌──────────────────────────────┐   │
│  │ What are Swap Points?        │   │
│  └──────────────────────────────┘   │
│  (100 char max)                     │
│                                     │
│  Body                               │
│  ┌──────────────────────────────┐   │
│  │ Swap Points are our special  │   │
│  │ currency! When you sell...   │   │
│  │                              │   │
│  └──────────────────────────────┘   │
│  (2000 char max, 450 remaining)     │
│                                     │
│  Image URL (optional)               │
│  ┌──────────────────────────────┐   │
│  │ https://cdn.../sp-icon.png   │   │
│  └──────────────────────────────┘   │
│                                     │
│  [Save Draft]  [Preview]  [Publish] │
└─────────────────────────────────────┘
```

---

### **Component: ExampleTable**

**Columns:**
| Column | Content |
|--------|---------|
| Item Name | "LEGO Set" |
| Price | $20.00 |
| Earn SP | 16 SP (auto-calculated) |
| Max Use SP | 10 SP (auto-calculated) |
| Status | Published / Draft |
| Actions | Edit, Delete |

---

### **Component: MobilePreview**

**Opens in modal:**
```
┌─────────────────────────────────────┐
│  📱 Mobile Preview          [✕]     │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐  │
│  │                               │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │ How Trading Works       │  │  │
│  │  │                         │  │  │
│  │  │ What are Swap Points?   │  │  │
│  │  │ ▼                       │  │  │
│  │  │ Swap Points are our...  │  │  │
│  │  │                         │  │  │
│  │  │ How to Earn SP          │  │  │
│  │  │ ▶                       │  │  │
│  │  └─────────────────────────┘  │  │
│  │                               │  │
│  └───────────────────────────────┘  │
│  (Simulated iPhone screen)          │
└─────────────────────────────────────┘
```

---

### **Component: AnalyticsDashboard**

```
┌─────────────────────────────────────┐
│  Education Analytics                │
│  Apr 1-20, 2026                     │
├─────────────────────────────────────┤
│  Onboarding                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  Started: 1,234 users               │
│  Completed: 876 (71%)               │
│  Skipped: 358 (29%)                 │
│  Avg completion time: 1m 23s        │
│                                     │
│  Drop-off by Screen:                │
│  Screen 1: 100%                     │
│  Screen 2: 92%                      │
│  Screen 3: 78% ⚠️                    │
│  Screen 4: 75%                      │
│  Screen 5: 71%                      │
│                                     │
│  Help Section                       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  Total views: 456                   │
│  Avg time spent: 2m 14s             │
│                                     │
│  Most Viewed Sections:              │
│  1. SP Definition (89%)             │
│  2. SP Spending (67%)               │
│  3. SP Earning (54%)                │
│  4. Safety (23%)                    │
│                                     │
│  SP Calculator                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  Total uses: 234                    │
│  Unique users: 178 (45% of sellers) │
│  Avg price entered: $18.50          │
└─────────────────────────────────────┘
```

---

## Complete Function Reference

### **Database (3 migrations, 12 objects)**

| # | Type | Object | Purpose |
|---|------|--------|---------|
| 1 | Table | `education_sections` | Store configurable content |
| 2 | Table | `education_examples` | Trade scenario examples |
| 3 | Table | `education_analytics` | User engagement tracking |
| 4 | Function | `update_education_sections_updated_at()` | Trigger: auto-update timestamp |
| 5 | Trigger | `education_sections_updated_at` | Auto-update on edit |
| 6 | Trigger | `education_examples_updated_at` | Auto-update on edit |
| 7 | Constraint | `unique_section_type` | One published per type |
| 8 | Index | `idx_education_sections_published` | Query published content |
| 9 | Index | `idx_education_sections_type` | Filter by type |
| 10 | Index | `idx_education_examples_published` | Query published examples |
| 11 | Index | `idx_education_analytics_event_type` | Aggregate by event |
| 12 | Index | `idx_education_analytics_user` | User activity timeline |

---

### **Backend Services (13 functions)**

| # | Function | Module | Purpose |
|---|----------|--------|---------|
| 1 | `getPublishedSections()` | ContentService | Fetch published sections |
| 2 | `getSectionByType()` | ContentService | Fetch specific section |
| 3 | `updateSection()` | ContentService | Edit section (admin) |
| 4 | `publishSection()` | ContentService | Publish section (admin) |
| 5 | `unpublishSection()` | ContentService | Unpublish section (admin) |
| 6 | `getPublishedExamples()` | ExampleService | Fetch published examples |
| 7 | `calculateExampleSP()` | ExampleService | Calculate category-aware SP for example |
| 8 | `createExample()` | ExampleService | Create new example (admin) |
| 9 | `deleteExample()` | ExampleService | Delete example (admin) |
| 10 | `calculateSP()` | SPCalculatorService | Category-aware SP calculator |
| 11 | `getBonusCategories()` | SPCalculatorService | Fetch categories with >1.10x earning |
| 12 | `trackEducationEvent()` | AnalyticsService | Log user engagement |
| 13 | `getEducationAnalytics()` | AnalyticsService | Fetch aggregated metrics |

---

### **Mobile App Components (43 functions)**

#### **OnboardingCarousel (8 functions)**

| # | Function | Purpose |
|---|----------|---------|
| 13 | `loadOnboardingScreens()` | Fetch content for 5 screens |
| 14 | `handleSwipe(direction)` | Navigate between screens |
| 15 | `handleSkip()` | Skip to home + track event |
| 16 | `handleNext()` | Advance to next screen |
| 17 | `handleComplete()` | Final screen → home |
| 18 | `trackOnboardingProgress(screen)` | Analytics: screen view |
| 19 | `shouldShowOnboarding()` | Check if user completed before |
| 20 | `markOnboardingComplete()` | Set flag in user preferences |

---

#### **HelpScreen (7 functions)**

| # | Function | Purpose |
|---|----------|---------|
| 21 | `loadHelpContent()` | Fetch all published sections |
| 22 | `expandSection(type)` | Accordion expand/collapse |
| 23 | `collapseAllSections()` | Reset accordion state |
| 24 | `scrollToSection(type)` | Deep link to specific section |
| 25 | `trackHelpView()` | Analytics: help access |
| 26 | `trackSectionExpand(type)` | Analytics: section interaction |
| 27 | `refreshContent()` | Pull-to-refresh |

---

#### **SPCalculator (8 functions)**

| # | Function | Purpose |
|---|----------|---------|
| 28 | `handlePriceInput(price)` | Update calculations |
| 29 | `handleCategorySelect(categoryId)` | Fetch category SP rates, recalculate |
| 30 | `calculateSellEarnings(price, categoryId)` | Show category-aware SP earned |
| 31 | `calculateBuyUsage(price, categoryId, sp)` | Show cash + fee with category cap |
| 32 | `formatSPValue(sp)` | Display formatting |
| 33 | `validatePriceInput(price)` | Min/max validation |
| 34 | `showBonusBadge(categoryId)` | Display ⭐ if category >1.10x |
| 35 | `trackCalculatorUse(price, categoryId, mode)` | Analytics: calculator usage |

---

#### **BonusCategoryBadge (3 functions)**

| # | Function | Purpose |
|---|----------|---------|
| 36 | `loadBonusCategories()` | Fetch categories with >1.10x earning |
| 37 | `renderBadgeIcon(category)` | Display ⭐ or custom icon |
| 38 | `navigateToCategoryDetails(categoryId)` | Show category SP rates |

---

#### **ContextualPrompts (7 functions)**

| # | Function | Purpose |
|---|----------|---------|
| 39 | `shouldShowPrompt(type)` | Check if prompt needed |
| 40 | `showSellerPrompt()` | Before first listing |
| 41 | `showBuyerPrompt()` | Before first purchase |
| 42 | `dismissPrompt(type)` | User closes prompt |
| 43 | `markPromptShown(type)` | Don't show again |
| 44 | `navigateToFullHelp()` | "Learn more" link |
| 45 | `trackPromptDismissal(type)` | Analytics: prompt effectiveness |

---

#### **ExampleScenarios (5 functions)**

| # | Function | Purpose |
|---|----------|---------|
| 46 | `loadExamples()` | Fetch published examples with categories |
| 47 | `renderExample(example)` | Display item + category-aware calculations |
| 48 | `calculateExampleValues(price, categoryId)` | Client-side category-aware SP math |
| 49 | `formatCurrency(amount)` | $XX.XX display |
| 50 | `showBonusBadge(example)` | Display ⭐ if bonus category |

---

#### **Admin - EducationContentPage (7 functions)**

| # | Function | Purpose |
|---|----------|---------|
| 51 | `loadAllSections()` | Fetch sections for table |
| 52 | `handleEditSection(id)` | Open edit modal |
| 53 | `handlePublishSection(id)` | Publish section to users |
| 54 | `handlePreviewSection(id)` | Mobile preview modal |
| 55 | `loadExamples()` | Fetch example scenarios |
| 56 | `handleEditExample(id)` | Open example edit form |
| 57 | `handleDeleteExample(id)` | Delete example scenario |

---

**Total Mobile App Functions:** 50 + 7 (admin) = **57 functions**  
**Total Project Functions:** 13 (backend) + 57 (mobile/admin) = **70 functions**  
**Total Database Objects:** 12

---
| 47 | `handlePublishSection(id)` | Publish with confirmation |
| 48 | `handlePreviewSection(id)` | Open mobile preview |
| 49 | `handleCreateSection()` | Open create modal |
| 50 | `handleDeleteSection(id)` | Delete with confirmation |

---

## Component Specifications

### **OnboardingCarousel**

**Screen 1/5 — Welcome:**
```
┌─────────────────────────────────────┐
│              ● ○ ○ ○ ○               │
│                                     │
│  [Large logo illustration]          │
│                                     │
│  Welcome to                         │
│  Kids P2P Marketplace!              │
│                                     │
│  Trade toys, books, and more with   │
│  families in your community.        │
│                                     │
│                                     │
│  [Skip]                    [Next →] │
└─────────────────────────────────────┘
```

**Screen 2/5 — SP Definition:**
```
┌─────────────────────────────────────┐
│              ○ ● ○ ○ ○               │
│                                     │
│  [Coin icon illustration]           │
│                                     │
│  What are Swap Points?              │
│                                     │
│  Our special currency! Earn points  │
│  by selling items, use them to save │
│  money on purchases.                │
│                                     │
│  [Skip]                    [Next →] │
└─────────────────────────────────────┘
```

---

### **HelpScreen**

```
┌─────────────────────────────────────┐
│  < Settings   How Trading Works     │
├─────────────────────────────────────┤
│  ┌────────────────────────────────┐ │
│  │ What are Swap Points? ▼        │ │
│  │──────────────────────────────  │ │
│  │ Swap Points are our special    │ │
│  │ currency! When you sell items, │ │
│  │ you earn SP...                 │ │
│  └────────────────────────────────┘ │
│                                     │
│  ┌────────────────────────────────┐ │
│  │ How to Earn SP ▶               │ │
│  └────────────────────────────────┘ │
│                                     │
│  ┌────────────────────────────────┐ │
│  │ How to Spend SP ▶              │ │
│  └────────────────────────────────┘ │
│                                     │
│  ┌────────────────────────────────┐ │
│  │ 💰 SP Calculator               │ │
│  │ Item Price: $ ____             │ │
│  │ Earn: __ SP | Use: __ SP       │ │
│  └────────────────────────────────┘ │
│                                     │
│  ┌────────────────────────────────┐ │
│  │ Safety & Trust ▶               │ │
│  └────────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

### **SPCalculator (Widget)**

```
┌─────────────────────────────────────┐
│  💰 Swap Points Calculator          │
├─────────────────────────────────────┤
│  Category                           │
│  ┌──────────────────────────────┐   │
│  │ Toys & Games            ▼    │   │
│  └──────────────────────────────┘   │
│                                     │
│  Item Price                         │
│  ┌──────────────────────────────┐   │
│  │ $ 20                         │   │
│  └──────────────────────────────┘   │
│                                     │
│  ━━━ If you SELL ━━━                │
│  You'll earn: 22 SP ⭐              │
│  (Toys: 1.10× bonus)                │
│                                     │
│  ━━━ If you BUY ━━━                 │
│  You can use: up to 14 SP (70%)     │
│  You'll pay: $6 cash + fee          │
└─────────────────────────────────────┘
```

**Features:**
- Category dropdown (fetches SP rates dynamically)
- Shows ⭐ badge if category earns >1.10x
- Real-time calculation on price/category change
- Progressive disclosure (shows amounts, hides technical multipliers)

---

### **BonusCategoryBadge (Component)**

**Purpose:** Visual indicator for categories with bonus SP earning

**Variants:**

**Default (⭐ Emoji):**
```
┌──────────────────────┐
│ 📚 Books         ⭐  │
│ Earn bonus SP!       │
└──────────────────────┘
```

**Custom Icon (Admin Upload):**
```
┌──────────────────────┐
│ 📚 Books      [🔥]   │
│ Earn bonus SP!       │
└──────────────────────┘
```

**Usage Locations:**
- Category selection modals (when listing or browsing)
- Help section ("Bonus Categories" list)
- Item detail page (if item is in bonus category)
- SP Calculator (next to earning amount)

**Props:**
```typescript
interface BonusCategoryBadgeProps {
  category: {
    id: string;
    name: string;
    icon: string;
    sp_earning_multiplier: number;
    bonus_badge_icon_url?: string; // Custom uploaded icon
  };
  showDescription: boolean; // Show "Earn bonus SP!" text
  size: 'small' | 'medium' | 'large';
}
```

---

### **ContextualPrompt (Modal)**

**Before First Listing:**
```
┌─────────────────────────────────────┐
│  💰 Earn Swap Points!               │
├─────────────────────────────────────┤
│  When you sell this item, you'll    │
│  earn SP based on the category!     │
│                                     │
│  Some categories earn bonus SP ⭐   │
│  Check which categories have the    │
│  best rewards!                      │
│                                     │
│  [Learn More]          [Got It!]    │
└─────────────────────────────────────┘
```

**Before First Purchase:**
```
┌─────────────────────────────────────┐
│  💰 Save with Swap Points!          │
├─────────────────────────────────────┤
│  You can use your SP to save money! │
│                                     │
│  Most categories let you use up to  │
│  70% of the price in SP - check the │
│  category details for the exact %.  │
│                                     │
│  [Learn More]          [Got It!]    │
└─────────────────────────────────────┘
```

---

## Performance Requirements

| Metric | Target | Method |
|--------|--------|--------|
| Help content load | < 1s | Cached sections |
| SP calculator update | < 100ms | Client-side math with cached category rates |
| Category SP rates fetch | < 200ms | Indexed query on categories table |
| Bonus categories query | < 150ms | Indexed on sp_earning_multiplier |
| Onboarding screen transition | < 200ms | Pre-loaded assets |
| Section expand/collapse | < 150ms | Smooth animation |
| Admin preview render | < 500ms | Cached mobile template |
| Admin publish | < 1s | Optimistic update |
| Analytics query | < 2s | Pre-aggregated data |
| Example load with category | < 500ms | Indexed query with JOIN |

---

## Accessibility Requirements

- Onboarding: swipe gesture + next/skip buttons (keyboard navigable)
- Help sections: screen reader announces "collapsed" or "expanded"
- SP calculator: input labeled "Item price, currency input"
- Example scenarios: formatted as readable list ("Sell LEGO Set for $20, earn 16 SP")
- Contextual prompts: focus trap, Esc to dismiss
- Admin forms: all fields labeled, error messages announced
- Mobile preview: accessible to screen readers (simulated content)

---

## Testing Requirements

### **Unit Tests**

| Test | Location | Coverage |
|------|----------|---------|
| `calculateSP()` | `__tests__/services/spCalculator.test.ts` | Category-aware sell/buy modes, various multipliers (1.05-1.40), spending caps (50-80%) |
| `getBonusCategories()` | `__tests__/services/spCalculator.test.ts` | Filters only >1.10x, correct ordering |
| `calculateExampleSP()` | `__tests__/services/exampleService.test.ts` | Category-aware calculations, price edge cases |
| `shouldShowOnboarding()` | `__tests__/utils/onboarding.test.ts` | First-time vs returning user |
| `trackEducationEvent()` | `__tests__/services/analytics.test.ts` | Event insertion |
| `publishSection()` | `__tests__/services/contentService.test.ts` | Publish workflow |
| `unique_section_type constraint` | SQL test | One published per type |
| `BonusCategoryBadge render` | `__tests__/components/BonusCategoryBadge.test.tsx` | Default ⭐, custom icon, various sizes |

### **Integration Tests**

| Test | Supabase | Description |
|------|----------|-------------|
| Content publish workflow | Prod staging | Edit → save draft → preview → publish → verify live |
| SP calculator category accuracy | Prod staging | Test calculations with different categories (1.10x, 1.30x), verify earning/spending |
| Bonus category query | Prod staging | Set 3 categories >1.10x, query getBonusCategories() → verify 3 returned |
| Example with category | Prod staging | Create example with category → verify SP calculated correctly |
| Analytics aggregation | Prod staging | Insert events → query metrics → verify counts |

### **Maestro UI Flow Tests**

| Flow | File | States Covered |
|------|------|---------------|
| Onboarding | `.maestro/onboarding-flow.yaml` | Start, swipe, skip, complete |
| Help access | `.maestro/help-flow.yaml` | Navigate, expand section, use calculator with category selection |
| Contextual prompts | `.maestro/contextual-prompts-flow.yaml` | First listing, first purchase prompts with category bonuses |
| Admin content edit | `.maestro/admin-edit-education.yaml` | Edit, preview, publish |
| Bonus category display | `.maestro/bonus-category-badge.yaml` | View bonus categories, see ⭐ badges |

---

## Acceptance Criteria

### **AC-001: First-Time User Onboarding**
- [ ] First app open shows 5-screen carousel
- [ ] Swipe left to advance, swipe right to go back
- [ ] Progress dots show current screen (3/5)
- [ ] "Skip" button on every screen
- [ ] Final screen "Get Started" navigates to home
- [ ] Onboarding not shown on subsequent app opens

### **AC-002: Help Section Access**
- [ ] Settings → Help → How Trading Works
- [ ] All 4 sections loaded and displayed
- [ ] SP Definition section expanded by default
- [ ] Other sections collapsed (tap to expand)
- [ ] SP Calculator always visible below sections

### **AC-003: SP Calculator Functionality**
- [ ] Select category: "Toys & Games" (1.10x earn, 70% spend)
- [ ] Enter price: $25
- [ ] Shows "Earn 27.50 SP ⭐" in sell section (1.10× multiplier)
- [ ] Shows "Use up to 17.50 SP (70%)" in buy section
- [ ] Shows "Pay $7.50 cash + fee" in buy section
- [ ] Change category to "Books" (1.30x earn, 75% spend)
- [ ] Shows "Earn 32.50 SP ⭐" (updated calculation)
- [ ] Shows "Use up to 18.75 SP (75%)" (updated spending cap)
- [ ] All calculations update instantly (<100ms)

### **AC-003B: Bonus Category Badge Display**
- [ ] Navigate to Help → "Bonus Categories" section
- [ ] See list of categories with >1.10x earning
- [ ] Each category shows ⭐ badge (or custom uploaded icon)
- [ ] See example: "Books: Earn 1.30× SP ⭐"
- [ ] Tap category → navigates to category details
- [ ] In SP Calculator, bonus categories show ⭐ next to earning amount

### **AC-004: Contextual Prompt (First Listing)**
- [ ] New user taps "Create Listing" for first time
- [ ] Modal: "Earn Swap Points!"
- [ ] Explains category-based SP earning with bonus categories ⭐
- [ ] Shows example: "Books: Earn 39 SP on $30 item ⭐"
- [ ] "Got It!" dismisses modal
- [ ] Prompt not shown on subsequent listings

---

### **AC-005: Admin Edit Content**
- [ ] Admin portal → Education → Sections
- [ ] Click "Edit" on "What are Swap Points?"
- [ ] Change body text
- [ ] Click "Save Draft" → changes saved, not published
- [ ] Click "Preview" → see mobile preview
- [ ] Click "Publish" → content goes live immediately
- [ ] Mobile app refreshes and shows new content

---

### **AC-006: Admin Create Example**
- [ ] Admin → Examples → Add Example
- [ ] Enter: Item name "Bicycle", Price $100
- [ ] Select category: "Toys & Games" (1.10x earn, 70% spend)
- [ ] Save → example appears in table
- [ ] Shows calculated: Earn 110 SP (1.10×), Use up to 70 SP (70%)
- [ ] Publish → example visible in mobile Help section
- [ ] Mobile shows: "Sell Bicycle → Earn 110 SP ⭐"

### **AC-007: Analytics Dashboard**
- [ ] Admin → Education → Analytics
- [ ] See onboarding completion rate: 72%
- [ ] See drop-off points by screen
- [ ] See Help section views: 234
- [ ] See SP calculator usage: 156 uses
- [ ] Data refreshed daily

### **AC-008: Dynamic Example Calculations**
- [ ] Admin sets example: "LEGO Set", $40, category "Toys" (1.10x, 70%)
- [ ] Mobile app shows: "Sell LEGO Set → Earn 44 SP ⭐"
- [ ] Shows: "Buy LEGO Set → Use 28 SP (70%), pay $12 + fee"
- [ ] Admin changes category to "Books" (1.30x, 75%)
- [ ] Mobile updates: "Earn 52 SP ⭐" and "Use 30 SP (75%)"
- [ ] Admin changes price to $50 → mobile updates all calculations automatically

---

## Out of Scope (Post-MVP)

| Feature | Reason |
|---------|--------|
| Video tutorials | Video hosting complexity |
| Quiz/gamification | Not core to education MVP |
| Trade simulator | Complex UX, Phase 2 |
| Multi-language support | Internationalization Phase 2 |
| Personalized content (buyer vs seller) | Segmentation complexity |
| Push notification reminders | Notification infra Phase 2 |
| In-app chat support | Live support Phase 2 |
| Downloadable PDF guides | Export feature Phase 2 |

---

## Implementation Checklist

### **Database**
- [ ] Run migration: create `education_sections` table
- [ ] Run migration: create `education_examples` table
- [ ] Run migration: create `education_analytics` table
- [ ] Run migration: seed initial content (4 sections, 3 examples)
- [ ] Verify RLS policies on all tables
- [ ] Verify unique constraint on `section_type + is_published`

### **Backend Services**
- [ ] Implement `ContentService` (get, update, publish sections)
- [ ] Implement `ExampleService` (CRUD examples with category support, calculate category-aware SP)
- [ ] Implement `SPCalculatorService` (category-aware calculateSP, getBonusCategories)
- [ ] Implement `AnalyticsService` (track events, aggregate metrics)
- [ ] Add caching for published content (5-min TTL)
- [ ] Add caching for category SP rates (update on admin change)

### **Mobile App — Onboarding**
- [ ] Build `OnboardingCarousel` component (5 screens)
- [ ] Implement swipe navigation + progress dots
- [ ] Add "Skip" and "Next" buttons
- [ ] Integrate with user preferences (mark complete)
- [ ] Track analytics events (start, complete, skip)

### **Mobile App — Help Section**
- [ ] Build `HelpScreen` component
- [ ] Implement accordion sections (expand/collapse)
- [ ] Integrate SP Calculator widget
- [ ] Add pull-to-refresh
- [ ] Track analytics (view, section expand)

### **Mobile App — SP Calculator**
- [ ] Build `SPCalculator` component with category dropdown
- [ ] Fetch category SP rates (earning multiplier, spending cap)
- [ ] Implement category-aware real-time calculations
- [ ] Display bonus badge (⭐ or custom) if category >1.10x
- [ ] Add to Help section
- [ ] Add to Sell tab (optional, auto-fill category from listing)
- [ ] Add to Checkout (when SP toggle enabled, auto-fill from item)
- [ ] Track calculator usage analytics (price, category, mode)

### **Mobile App — Bonus Category Components**
- [ ] Build `BonusCategoryBadge` component (default ⭐, custom icon support)
- [ ] Integrate badge in category selection modals
- [ ] Add "Bonus Categories" section to Help screen
- [ ] Display badge on item detail pages (if item in bonus category)
- [ ] Implement custom icon rendering (fetch from bonus_badge_icon_url)

### **Mobile App — Contextual Prompts**
- [ ] Build modal component for prompts
- [ ] Trigger before first listing (seller prompt with category bonus mention)
- [ ] Trigger before first purchase (buyer prompt with spending cap mention)
- [ ] Implement dismissal tracking (don't show again)
- [ ] Track analytics (view, dismiss, learn more)

### **Admin Portal**
- [ ] Build `EducationContentPage` layout (3 tabs)
- [ ] Build `SectionTable` component
- [ ] Build `SectionForm` modal (create/edit)
- [ ] Build `MobilePreview` component
- [ ] Build `ExampleTable` + `ExampleForm` (with category dropdown)
- [ ] Build `AnalyticsDashboard` component
- [ ] Integrate all CRUD services

### **Tests**
- [ ] Unit tests: all calculator functions (category-aware, various multipliers)
- [ ] Unit tests: all service functions (getBonusCategories, calculateSP)
- [ ] Unit tests: BonusCategoryBadge rendering
- [ ] Integration tests: content publish workflow
- [ ] Integration tests: SP calculator with different categories
- [ ] Integration tests: bonus category query accuracy
- [ ] Maestro flows: all 5 flows listed in Testing Requirements
- [ ] Manual testing: real devices (iOS + Android)

### **Content**
- [ ] Write final copy for 4 core sections with category bonus mentions (marketing review)
- [ ] Update SP earning section to explain category variation
- [ ] Update SP spending section to explain category caps
- [ ] Design illustrations for onboarding screens
- [ ] Create category bonus examples for Help section
- [ ] Review safety section with legal/compliance
- [ ] Localize content (if multi-language scope added)

---

*Document version: 2.0 | Last updated: April 21, 2026 | Next review: after Track 4 + SP category implementation*
