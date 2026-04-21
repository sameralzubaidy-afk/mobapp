# Admin Category Management — Complete Requirements Document

**Project:** Kids P2P Marketplace  
**Feature:** Dynamic Category Management (Admin Portal)  
**Version:** 1.0  
**Date:** April 19, 2026  
**Owner:** @sameralzubaidy-afk  
**Target Release:** Week 4-6 (MVP Track 2 — parallel with Bulk Listing)

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

Current category management has critical admin & seller UX gaps:
- ❌ Categories hardcoded in database → no admin control
- ❌ No way to add new categories without database migration
- ❌ Empty categories clutter buyer search (no item count filtering)
- ❌ No "Other" option for sellers → forced into wrong category
- ❌ No way to track seller-requested categories
- ❌ No active/inactive toggle → must delete to hide categories

### **Solution Overview**

**Scope (Links to Track 2 Bulk Listing):**
1. **Admin Portal CRUD** — Full category management dashboard
2. **Category Suggestions** — Sellers can suggest new categories via "Other" option
3. **Smart Filtering** — Show item counts, hide empty categories in buyer flows

**Phase 1 (MVP — Weeks 4-6):**
- ✅ Admin category management page with full CRUD
- ✅ Category table with search, filter, bulk actions
- ✅ Create/edit category form (name, description, icon, display order)
- ✅ Active/inactive toggle (soft delete)
- ✅ Drag-and-drop reordering
- ✅ Item count per category (live)
- ✅ Category suggestion review queue (from "Other" option in seller flow)
- ✅ Approve/reject/merge suggestions
- ✅ Buyer-facing: hide categories with 0 items
- ✅ Buyer-facing: show count next to category name in search

**Phase 2 (Post-MVP):**
- Category icons upload (custom images)
- Nested subcategories
- Category merge tool (bulk reassign items)
- Category analytics (views, conversions)
- Category templates (pre-fill description for common categories)

### **Success Metrics**

| Metric | Current | Target (MVP) |
|--------|---------|--------------|
| Admin category operations | Manual SQL only | < 30s via UI |
| Seller category suggestion rate | 0% (no "Other" option) | Track post-launch |
| Buyer sees empty categories | Yes (cluttered) | No (smart filtered) |
| Category request backlog | Unknown | < 48h review time |
| Category count shown to buyers | No | Yes (all categories) |

---

## UX Decisions & Competitor Benchmarks

### **1. Admin Portal: Separate Category Management Page**
**Decision:** Dedicated page in admin portal with full CRUD table

**Rationale:**
- Shopify, Etsy, eBay admin all use dedicated category management pages
- Categories are foundational data → deserve full-featured interface
- Avoids clutter in main admin dashboard

**Navigation:** Admin Dashboard → Settings → Categories

---

### **2. Category Display: Show Item Counts**
**Decision:** Display active item count next to category name everywhere (buyer app, admin portal)

**Benchmark:**
| App | Category Count Display |
|-----|----------------------|
| eBay | "Toys & Hobbies (1,234)" |
| Etsy | "Handmade (45K)" |
| Facebook Marketplace | No count shown |
| Amazon | Category only, no count |
| **Kids Marketplace** | **"Toys (23)" in all buyer flows** |

**UI Pattern:**
- Format: `{Category Name} ({active_item_count})`
- Color: count in secondary text color
- Zero count: category hidden from buyer flows entirely

---

### **3. Empty Category Filtering**
**Decision:** Hide categories with 0 active items from buyer-facing flows only (admin still sees all)

**Rules:**
- Buyer search modal: show only categories with `item_count > 0`
- Admin portal: show all categories (including 0 count) with filter toggle
- Category create: immediately visible to admin, hidden from buyers until first item added

---

### **4. Category Suggestions: Review Queue**
**Decision:** Dedicated section in category management for seller-suggested categories

**Flow (from Track 2 Bulk Listing):**
1. Seller selects "Other" in category modal
2. Enters suggested category name (text input)
3. Stored in `items.requested_category_name`
4. Admin sees in Category Suggestions queue
5. Admin can: Approve (create new category + reassign item) | Reject (leave in "Other") | Merge (map to existing category)

**UI:** Badge on "Category Suggestions" tab shows pending count

---

### **5. Category CRUD: Form Fields**
**Decision:** Minimal fields for MVP, extensible later

**Fields:**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| name | TEXT | Yes | Max 50 chars, unique |
| description | TEXT | No | Max 200 chars |
| icon | TEXT | No | Emoji or icon name (Phase 2: upload) |
| icon_url | TEXT | No | Custom uploaded icon (URL to Supabase Storage) |
| display_order | INT | No | For manual sorting (drag-and-drop) |
| is_active | BOOLEAN | Yes | Default true |
| item_count | INT | Auto | Computed (not editable) |
| sp_earning_multiplier | DECIMAL | No | 1.05-1.40, default 1.10 (SP earning rate) |
| sp_spending_cap_percent | INT | No | 50-80, default 70 (max % of price payable in SP) |
| sp_config_notes | TEXT | No | Admin notes on why these SP rates |

---

### **6. Swap Points (SP) Configuration per Category**
**Decision:** Each category has configurable earning multiplier and spending cap

**Rationale:**
- Legal safety: Variable rates avoid "1 SP = $1" currency perception
- Market balancing: Boost underrepresented categories with higher SP rewards
- Anti-gaming: Prevent high-value category SP farming with lower spending caps
- Admin control: Adjust marketplace dynamics without code changes

**SP Earning Multiplier:**
- Range: 1.05x to 1.40x
- Default: 1.10x (all categories at launch)
- Example: Book at $30 with 1.30x → seller earns 39 SP

**SP Spending Cap:**
- Range: 50% to 80%
- Default: 70% (all categories at launch)
- Example: $40 item with 75% cap → buyer can use max 30 SP
- Always requires minimum 20-50% cash payment (legal compliance)

**Visual Communication:**
- Users never see multipliers or percentages
- Display actual SP amounts: "Earn 39 SP" (not "1.30x multiplier")
- Bonus categories marked with ⭐ badge (admin configurable icon)
- Progressive disclosure: simple upfront, details in Help

**Admin Badge Upload:**
- Default badge: ⭐ Star emoji
- Admin can upload custom icon (PNG/SVG) to Supabase Storage
- Icon displayed next to category in mobile app
- Renders for categories with earning multiplier >1.10x

**Notification System:**
- When admin changes category SP rates, optional in-app banner
- Admin checkbox: "Notify users of this change"
- Banner text: "Books now earn bonus SP!" (category-specific)

---

### **7. Bulk Actions**
**Decision:** Support batch activate/deactivate/delete

**Actions:**
- Activate selected
- Deactivate selected
- Delete selected (only if 0 items)
- Export to CSV

**Safety:**
- Delete only allowed if `item_count = 0`
- Deactivate shows warning: "X items will become uncategorized in search"
- All bulk actions require confirmation modal

---

### **8. Drag-and-Drop Reordering**
**Decision:** Admin can drag categories to change display order

**Implementation:**
- Table rows draggable
- Updates `display_order` field on drop
- Persists immediately (optimistic update)
- Buyer app respects `display_order ASC`

---

### **9. Category Icon: Emoji, Icon Name, or Custom Upload**
**Decision:** Support emoji, icon name, OR custom uploaded image

**Options:**
1. **Emoji:** Simple text field (e.g., "🧸")
2. **Icon Name:** Maps to icon library (e.g., "toy-icon" → FontAwesome)
3. **Custom Upload:** PNG/SVG file uploaded to Supabase Storage

**Bonus Badge Icon:**
- Separate field: `bonus_badge_icon_url`
- Default: ⭐ Star emoji
- Admin can upload custom badge icon (displayed when `sp_earning_multiplier > 1.10`)
- Renders in mobile app next to category name

**Implementation:**
- CategoryForm has tabbed interface: Emoji | Icon Library | Upload
- Upload validates: PNG/SVG only, max 500KB, min 100×100px
- Uploaded to `category-icons/{category_id}/icon.png` in Supabase Storage
- Returns public URL stored in `icon_url` column

---

### **10. Category Validation**
**Decision:** Enforce uniqueness, max length, no special characters in name

**Rules:**
- Name: 3-50 chars, alphanumeric + spaces only
- Description: max 200 chars
- Name must be unique (case-insensitive)
- Cannot delete category with `item_count > 0`
- Cannot deactivate default "Other" category
- **SP Earning Multiplier:** 1.05 to 1.40 (inclusive)
- **SP Spending Cap:** 50% to 80% (inclusive)
- SP spending cap must provide minimum 20% cash payment (legal requirement)
- Cannot set earning multiplier >1.40 (SP inflation risk)
- Cannot set spending cap >80% (legal/economic risk)

---

## User Stories

### **US-201: Admin Create Category**
**As an** admin  
**I want** to create new item categories via UI  
**So that** sellers have relevant options without waiting for a database migration

**Acceptance Criteria:**
- Can access category management from admin settings
- Form has name, description, icon, active toggle
- Submitting creates category immediately
- New category appears in seller category modal within 1 minute
- Can set display order via drag-and-drop

---

### **US-202: Admin Edit Category**
**As an** admin  
**I want** to update category name, description, or icon  
**So that** I can fix typos or improve clarity

**Acceptance Criteria:**
- Click category row → opens edit form
- Can change name, description, icon
- Cannot change name to duplicate existing category
- Changes reflected in buyer app within 1 minute

---

### **US-203: Admin Deactivate Category**
**As an** admin  
**I want** to hide a category without deleting it  
**So that** I can temporarily remove it from seller/buyer views

**Acceptance Criteria:**
- Toggle "Active" switch on category row
- Confirmation modal warns: "X items will be hidden from search"
- Inactive categories hidden from buyer search modal
- Inactive categories shown in admin portal with "Inactive" badge
- Can reactivate at any time

---

### **US-204: Admin Delete Category**
**As an** admin  
**I want** to permanently delete unused categories  
**So that** I clean up test or redundant categories

**Acceptance Criteria:**
- Delete button only enabled if `item_count = 0`
- Confirmation modal: "Are you sure? This cannot be undone."
- Successfully deleted category removed from all views
- Attempting to delete category with items shows error

---

### **US-205: Admin View Category Suggestions**
**As an** admin  
**I want** to see seller-requested categories  
**So that** I can approve or reject them

**Acceptance Criteria:**
- "Category Suggestions" tab shows badge with pending count
- Table shows: Suggested name, Seller, Item link, Date requested
- Can approve (creates category + reassigns item)
- Can reject (leaves item in "Other", optionally add note)
- Can merge (map to existing category + reassign item)

---

### **US-206: Admin Approve Category Suggestion**
**As an** admin  
**I want** to approve a suggested category  
**So that** it becomes available to all sellers

**Acceptance Criteria:**
- Click "Approve" on suggestion row
- Opens create category form with name pre-filled
- Can edit name/description before creating
- Creating category automatically reassigns the requesting item
- Suggestion removed from queue

---

### **US-207: Admin Merge Category Suggestion**
**As an** admin  
**I want** to map a suggested category to an existing one  
**So that** I avoid duplicates (e.g., "Legos" → "LEGO")

**Acceptance Criteria:**
- Click "Merge" on suggestion row
- Dropdown shows all existing categories
- Selecting category reassigns item
- Suggestion marked as merged (archived)

---

### **US-208: Buyer Sees Item Counts in Search**
**As a** buyer searching for items  
**I want** to see how many items are in each category  
**So that** I know which categories have inventory

**Acceptance Criteria:**
- Category modal shows: "Toys (23)", "Books (8)", etc.
- Count updates when items added/sold/deleted
- Count shows only active items (excludes sold/removed)
- Categories with 0 items are hidden entirely

---

### **US-209: Seller Sees "Other" Option**
**As a** seller listing an item  
**I want** an "Other" option when no category fits  
**So that** I can suggest a new category

**Acceptance Criteria:**
- Category modal shows "Other" at bottom
- Selecting "Other" shows text input: "What is this item?"
- Optional field (can skip)
- Submitting stores text in `items.requested_category_name`
- Admin sees suggestion in review queue

---

### **US-210: Admin Bulk Activate/Deactivate**
**As an** admin managing many categories  
**I want** to activate or deactivate multiple categories at once  
**So that** I save time

**Acceptance Criteria:**
- Checkboxes on each category row
- "Bulk Actions" dropdown appears when ≥1 selected
- Actions: Activate, Deactivate, Delete (if all have 0 items)
- Confirmation modal shows count: "Deactivate 5 categories?"
- All selected categories updated simultaneously

---

## Database Schema Changes

### **Migration 1: Add Columns to Categories Table**

**File:** `supabase/migrations/20260420000003_add_category_management_columns.sql`

```sql
-- ================================================================
-- Migration: Add Category Management Columns
-- Date: 2026-04-20
-- Description: Adds is_active, item_count, display_order to categories
-- ================================================================

-- Add new columns
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS item_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS display_order INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS description TEXT CHECK (LENGTH(description) <= 200),
  ADD COLUMN IF NOT EXISTS icon TEXT CHECK (LENGTH(icon) <= 50),
  ADD COLUMN IF NOT EXISTS icon_url TEXT,
  ADD COLUMN IF NOT EXISTS bonus_badge_icon_url TEXT,
  ADD COLUMN IF NOT EXISTS sp_earning_multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.10 
    CHECK (sp_earning_multiplier BETWEEN 1.05 AND 1.40),
  ADD COLUMN IF NOT EXISTS sp_spending_cap_percent INT NOT NULL DEFAULT 70 
    CHECK (sp_spending_cap_percent BETWEEN 50 AND 80),
  ADD COLUMN IF NOT EXISTS sp_config_notes TEXT CHECK (LENGTH(sp_config_notes) <= 500),
  ADD COLUMN IF NOT EXISTS sp_rate_change_notify BOOLEAN NOT NULL DEFAULT false;

-- Set initial display_order based on current ordering
UPDATE public.categories
SET display_order = ROW_NUMBER() OVER (ORDER BY id);

-- Index for active category queries
CREATE INDEX IF NOT EXISTS idx_categories_active
  ON categories(is_active, display_order)
  WHERE is_active = true;

-- Index for item count sorting
CREATE INDEX IF NOT EXISTS idx_categories_item_count
  ON categories(item_count DESC)
  WHERE is_active = true;

-- Index for bonus categories (earning multiplier > baseline)
CREATE INDEX IF NOT EXISTS idx_categories_bonus
  ON categories(sp_earning_multiplier DESC)
  WHERE is_active = true AND sp_earning_multiplier > 1.10;

COMMENT ON COLUMN categories.is_active IS 'Active categories shown to buyers/sellers; inactive hidden';
COMMENT ON COLUMN categories.item_count IS 'Computed count of active items in this category';
COMMENT ON COLUMN categories.display_order IS 'Manual sort order (drag-and-drop)';
COMMENT ON COLUMN categories.description IS 'Optional description (max 200 chars)';
COMMENT ON COLUMN categories.icon IS 'Emoji or icon identifier (max 50 chars)';
COMMENT ON COLUMN categories.icon_url IS 'Custom uploaded icon URL (Supabase Storage)';
COMMENT ON COLUMN categories.bonus_badge_icon_url IS 'Custom bonus badge icon (default: ⭐)';
COMMENT ON COLUMN categories.sp_earning_multiplier IS 'SP earning rate multiplier (1.05-1.40, default 1.10)';
COMMENT ON COLUMN categories.sp_spending_cap_percent IS 'Max % of item price payable in SP (50-80%, default 70%)';
COMMENT ON COLUMN categories.sp_config_notes IS 'Admin notes on SP rate rationale';
COMMENT ON COLUMN categories.sp_rate_change_notify IS 'Trigger notification when SP rates change';
```

---

### **Migration 2: Create category_suggestions Table**

```sql
-- ================================================================
-- Migration: Create category_suggestions Table
-- Date: 2026-04-20
-- Description: Track seller-suggested categories for admin review
-- ================================================================

CREATE TABLE IF NOT EXISTS public.category_suggestions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggested_name    TEXT NOT NULL CHECK (LENGTH(suggested_name) BETWEEN 3 AND 100),
  seller_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id           UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'merged')),
  approved_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  merged_to_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  admin_note        TEXT CHECK (LENGTH(admin_note) <= 500),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at       TIMESTAMPTZ,

  CONSTRAINT unique_item_suggestion UNIQUE (item_id)
);

-- RLS
ALTER TABLE public.category_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage all suggestions"
  ON public.category_suggestions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Seller can view own suggestions"
  ON public.category_suggestions
  FOR SELECT
  USING (seller_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_category_suggestions_status
  ON category_suggestions(status, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_category_suggestions_seller
  ON category_suggestions(seller_id, created_at DESC);

COMMENT ON TABLE public.category_suggestions IS 'Seller-suggested categories from "Other" option in category modal';
```

---

### **Migration 3: Trigger to Update item_count**

```sql
-- ================================================================
-- Migration: Auto-Update Category Item Count
-- Description: Trigger updates categories.item_count when items change
-- ================================================================

-- Function to recompute category item_count
CREATE OR REPLACE FUNCTION update_category_item_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Recompute count for affected categories
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.categories
    SET item_count = (
      SELECT COUNT(*)
      FROM public.items
      WHERE category_id = NEW.category_id
        AND status = 'available'
    )
    WHERE id = NEW.category_id;
  END IF;

  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.category_id != NEW.category_id) THEN
    UPDATE public.categories
    SET item_count = (
      SELECT COUNT(*)
      FROM public.items
      WHERE category_id = OLD.category_id
        AND status = 'available'
    )
    WHERE id = OLD.category_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger on items table
CREATE TRIGGER update_category_item_count_trigger
  AFTER INSERT OR UPDATE OF category_id, status OR DELETE
  ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION update_category_item_count();

-- Initial count computation (run once)
UPDATE public.categories c
SET item_count = (
  SELECT COUNT(*)
  FROM public.items i
  WHERE i.category_id = c.id
    AND i.status = 'available'
);

COMMENT ON FUNCTION update_category_item_count() IS 'Trigger function to keep category item counts in sync';
```

---

### **Migration 4: Add RPC for Category Reordering**

```sql
-- ================================================================
-- RPC: Reorder Categories
-- Description: Batch update display_order for drag-and-drop
-- ================================================================

CREATE OR REPLACE FUNCTION reorder_categories(
  category_orders JSONB -- Array of {id: uuid, display_order: int}
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cat_record RECORD;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;

  -- Update each category's display_order
  FOR cat_record IN SELECT * FROM jsonb_to_recordset(category_orders) AS (id UUID, display_order INT)
  LOOP
    UPDATE public.categories
    SET display_order = cat_record.display_order
    WHERE id = cat_record.id;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION reorder_categories(JSONB) IS 'Admin RPC to batch update category display_order for drag-and-drop';
```

---

## Backend Functions (RPCs & Services)

### **Category CRUD**

#### `createCategory(data: CreateCategoryInput): Promise<Category>`
- Validates name uniqueness (case-insensitive)
- Validates name length (3-50 chars), no special characters except spaces
- Sets `display_order` to max + 1
- Returns created category
- **Error:** Throws if duplicate name

#### `updateCategory(id: string, updates: Partial<Category>): Promise<Category>`
- Validates name uniqueness if changing name
- Cannot change `item_count` (computed field)
- Returns updated category
- **Error:** Throws if duplicate name or category not found

#### `deleteCategory(id: string): Promise<void>`
- Checks `item_count = 0`
- Hard deletes category
- **Error:** Throws if `item_count > 0` or category not found

#### `getCategoriesWithCounts(includeInactive?: boolean): Promise<Category[]>`
- Returns all categories with live `item_count`
- If `includeInactive=false` (default for buyer flows): only `is_active=true`
- If `includeInactive=true` (admin portal): all categories
- Orders by `display_order ASC`

#### `toggleCategoryActive(id: string, isActive: boolean): Promise<Category>`
- Updates `is_active` field
- Returns updated category
- No deletion of items (items remain, just hidden from search)

#### `reorderCategories(orders: Array<{ id: string; display_order: number }>): Promise<void>`
- Batch updates `display_order` for drag-and-drop
- Calls `reorder_categories()` RPC
- Optimistic update on client

---

### **Category Suggestions**

#### `getCategorySuggestions(status?: 'pending' | 'approved' | 'rejected' | 'merged'): Promise<CategorySuggestion[]>`
- Returns category suggestions with item + seller details
- If `status` provided: filters by status
- If no status: returns all pending
- Orders by `created_at DESC`

#### `approveCategorySuggestion(suggestionId: string, categoryData: CreateCategoryInput): Promise<Category>`
- Creates new category using provided data
- Reassigns item to new category
- Updates suggestion status to 'approved'
- Sets `approved_by` to current admin user
- Returns created category
- **Transaction:** All updates in single transaction (rollback on error)

#### `rejectCategorySuggestion(suggestionId: string, adminNote?: string): Promise<void>`
- Updates suggestion status to 'rejected'
- Sets `reviewed_at` timestamp
- Optionally stores admin note
- Item remains in "Other" category

#### `mergeCategorySuggestion(suggestionId: string, targetCategoryId: string): Promise<void>`
- Reassigns item to target category
- Updates suggestion status to 'merged'
- Sets `merged_to_category_id`
- Sets `reviewed_at` timestamp

#### `createCategorySuggestionFromItem(itemId: string, suggestedName: string): Promise<CategorySuggestion>`
- Called automatically when seller selects "Other" + enters name
- Creates suggestion record
- Links to item via `item_id`
- Returns created suggestion
- **Note:** This is called from Track 2 ItemCreateScreen

---

### **Utilities**

#### `validateCategoryName(name: string): ValidationResult`
- Checks: 3-50 chars, alphanumeric + spaces only
- Returns `{ valid: boolean; error?: string }`

#### `checkCategoryUniqueness(name: string, excludeId?: string): Promise<boolean>`
- Queries categories for case-insensitive name match
- Excludes `excludeId` if provided (for updates)
- Returns `true` if unique, `false` if duplicate

---

### **SP Configuration Functions**

#### `calculateCategorySP(categoryId: string, itemPrice: number): Promise<{ earn_sp: number; max_spend_sp: number; spend_percent: number }>`
- Fetches category's `sp_earning_multiplier` and `sp_spending_cap_percent`
- Calculates: `earn_sp = itemPrice * sp_earning_multiplier`
- Calculates: `max_spend_sp = itemPrice * (sp_spending_cap_percent / 100)`
- Returns earning, max spending, and spending percentage for display
- Used in item listing preview and purchase checkout

#### `getBonusCategories(): Promise<BonusCategory[]>`
- Returns categories where `sp_earning_multiplier > 1.10`
- Includes category name, icon, bonus badge icon, earning multiplier
- Orders by `sp_earning_multiplier DESC`
- Used to display bonus categories in Help section and category browse

#### `updateCategorySPRates(categoryId: string, earningMultiplier: number, spendingCap: number, notifyUsers: boolean, notes?: string): Promise<Category>`
- Validates: `earningMultiplier` between 1.05-1.40
- Validates: `spendingCap` between 50-80
- Updates category SP rates
- Sets `sp_config_notes` if provided
- If `notifyUsers=true`: triggers in-app banner notification
- Returns updated category
- **Error:** Throws if out of valid range

#### `uploadCategoryIcon(categoryId: string, iconFile: File, iconType: 'category' | 'bonus_badge'): Promise<string>`
- Validates: PNG/SVG only, max 500KB, min 100×100px
- Uploads to Supabase Storage: `category-icons/{categoryId}/{iconType}.{ext}`
- Returns public URL
- Updates category `icon_url` or `bonus_badge_icon_url` column
- **Error:** Throws if invalid file type or size

#### `getSPAnalyticsByCategory(): Promise<CategorySPAnalytics[]>`
- Returns SP health metrics per category:
  - SP velocity (earn/spend ratio)
  - SP accumulation (gap between earning and spending)
  - Cash flow (avg cash per transaction)
  - Gaming detection (users exploiting category rates)
- Orders by SP velocity DESC
- Used in admin SP analytics dashboard

---

## Admin Portal Architecture

### **Page: CategoryManagementPage**

**Path:** `admin-portal/src/pages/CategoryManagementPage.tsx` (or `/admin/categories`)

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Admin Dashboard > Settings > Categories         │
├─────────────────────────────────────────────────┤
│                                                 │
│  Categories (23)  │  Suggestions (5) 🔴       │
│  ════════════════════════════════════════════  │
│                                                 │
│  [Search categories...]        [+ New Category] │
│  [All] [Active] [Inactive]     [Bulk Actions ▼] │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ CategoryTable                          │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Tabs:**
1. **Categories** — Main CRUD table
2. **Suggestions** — Pending seller requests (badge shows count)

---

### **Component: CategoryTable**

**Columns:**
| Column | Width | Content |
|--------|-------|---------|
| ☰ | 40px | Drag handle |
| ☑ | 40px | Checkbox (bulk select) |
| Icon | 60px | Emoji or icon (shows custom if uploaded) |
| Badge | 40px | ⭐ if SP earning >1.10x |
| Name | 200px | Category name (editable inline) |
| Item Count | 80px | Active item count (live) |
| SP Earn | 80px | "1.10×" or "1.30× ⭐" |
| SP Spend | 80px | "70%" or "75%" |
| Status | 90px | Active/Inactive badge + toggle |
| Actions | 100px | Edit, Delete buttons |

**Features:**
- Search bar filters by name (debounced 300ms)
- Filter tabs: All, Active (is_active=true), Inactive (is_active=false), Bonus (sp_earning_multiplier>1.10)
- Drag-and-drop rows to reorder
- Bulk select checkboxes
- Click SP Earn or SP Spend cell to edit inline
- Hover SP cells shows preview calculator
- Inline edit name (double-click)
- Pagination: 20 per page

---

### **Component: CategoryForm (Modal)**

**Tabbed Interface:**
1. **Basic Info** — Name, description, active toggle
2. **Icon & Badge** — Category icon + bonus badge icon upload
3. **SP Configuration** — Earning multiplier + spending cap

**Tab 1: Basic Info**
```
┌─────────────────────────────────────┐
│  Create Category            [✕]     │
├─────────────────────────────────────┤
│  [Basic Info] [Icon & Badge] [SP Config]│
│  ════════════                       │
│  Name *                             │
│  ┌──────────────────────────────┐   │
│  │ e.g., Toys & Games           │   │
│  └──────────────────────────────┘   │
│  3-50 characters                    │
│                                     │
│  Description                        │
│  ┌──────────────────────────────┐   │
│  │ Optional description...      │   │
│  └──────────────────────────────┘   │
│  Max 200 characters                 │
│                                     │
│  ☑ Active (show to buyers/sellers)  │
│                                     │
│  [Cancel]     [Next: Icon & Badge]  │
└─────────────────────────────────────┘
```

**Tab 2: Icon & Badge**
```
┌─────────────────────────────────────┐
│  Category Icon                      │
│                                     │
│  [Emoji] [Icon Name] [Upload]       │
│  ────────                           │
│                                     │
│  ┌──────────────────────────────┐   │
│  │ 🧸 (emoji or icon name)      │   │
│  └──────────────────────────────┘   │
│                                     │
│  OR Upload Custom Icon:             │
│  [Browse Files...] 📁               │
│  PNG/SVG, max 500KB, min 100×100px  │
│                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  Bonus Badge Icon (shown if SP>1.10)│
│                                     │
│  Default: ⭐                         │
│  OR Upload Custom Badge:            │
│  [Browse Files...] 📁               │
│                                     │
│  [← Back]         [Next: SP Config] │
└─────────────────────────────────────┘
```

**Tab 3: SP Configuration**
```
┌─────────────────────────────────────┐
│  Swap Points Configuration          │
│                                     │
│  Earning Multiplier                 │
│  ┌──────────────────────────────┐   │
│  │ 1.10  ×                      │   │
│  └──────────────────────────────┘   │
│  Range: 1.05 to 1.40                │
│  Default: 1.10 (standard rate)      │
│                                     │
│  Spending Cap                       │
│  ┌──────────────────────────────┐   │
│  │ 70  %                        │   │
│  └──────────────────────────────┘   │
│  Range: 50% to 80%                  │
│  Default: 70% (standard cap)        │
│                                     │
│  ━━━ Preview Example (for $50 item)│
│  • Seller earns: 55 SP (1.10×)      │
│  • Buyer can use: up to 35 SP (70%) │
│  • Buyer pays: $15 cash + fee       │
│                                     │
│  Strategy Notes (optional):         │
│  ┌─────────────────────────────────┐ │
│  │ e.g., "Boosting books to        │ │
│  │ encourage literacy listings"    │ │
│  └─────────────────────────────────┘ │
│  Max 500 characters                 │
│                                     │
│  ☑ Notify users when rates change   │
│                                     │
│  [← Back]                 [Create]  │
└─────────────────────────────────────┘
```

**Validation:**
- Name required, unique, 3-50 chars
- Description optional, max 200 chars
- Icon optional (emoji, icon name, or uploaded file)
- SP earning multiplier: 1.05-1.40 (validated on blur)
- SP spending cap: 50-80% (validated on blur)
- SP notes optional, max 500 chars
- Real-time duplicate check (debounced 500ms)
- Live preview updates as values change

---

### **Component: SPAnalyticsDashboard (NEW)**

**Purpose:** Track SP health metrics per category

**Layout:**
```
┌─────────────────────────────────────────────────┐
│  SP Analytics by Category                       │
├─────────────────────────────────────────────────┤
│  Date Range: [Last 30 days ▼]                   │
│                                                 │
│  ┌────────────────────────────────────────────┐ │
│  │ Category    │ Velocity │ Gap │ Cash Flow │ │
│  ├────────────────────────────────────────────┤ │
│  │ 📚 Books ⭐  │  0.92    │ +5% │  $8.50    │ │
│  │ 🧸 Toys      │  1.05    │ -2% │  $12.30   │ │
│  │ 👶 Baby Gear │  0.78    │ +15%│  $6.20    │ │
│  └────────────────────────────────────────────┘ │
│                                                 │
│  🔴 Alerts:                                     │
│  • Books: SP accumulation >10% (users hoarding)│
│  • Baby Gear: Low velocity (increase spending?)│
└─────────────────────────────────────────────────┘
```

**Metrics:**
- **Velocity:** Earn/Spend ratio (ideal: 1.0)
- **Gap:** % difference between earning and spending
- **Cash Flow:** Avg cash per transaction
- **Alerts:** Flagged categories requiring rate adjustment

---

### **Component: CategorySuggestionsList**

**Table Columns:**
| Column | Content |
|--------|---------|
| Suggested Name | Text entered by seller |
| Item | Link to item detail (opens in new tab) |
| Seller | Seller name + ID |
| Date | Created timestamp |
| Actions | Approve, Merge, Reject buttons |

**Actions:**
- **Approve** → Opens CategoryForm with name pre-filled
- **Merge** → Opens dropdown of existing categories
- **Reject** → Opens confirmation modal with optional note field

---

### **Component: BulkActionsDropdown**

**Appears when:** ≥1 category selected

**Actions:**
| Action | Enabled When | Confirmation |
|--------|--------------|--------------|
| Activate | Any selected | "Activate N categories?" |
| Deactivate | Any selected | "Deactivate N categories? X items will be hidden." |
| Delete | All selected have `item_count=0` | "Permanently delete N categories?" |
| Export CSV | Any selected | No confirmation (immediate download) |

---

## Complete Function Reference

### **Database (5 migrations, 18 objects)**

| # | Type | Object | Purpose |
|---|------|--------|---------|
| 1 | Column | `categories.is_active` | Soft delete toggle |
| 2 | Column | `categories.item_count` | Live count of active items |
| 3 | Column | `categories.display_order` | Manual sort order |
| 4 | Column | `categories.description` | Optional category description |
| 5 | Column | `categories.icon` | Emoji or icon identifier |
| 6 | Column | `categories.icon_url` | Custom uploaded icon URL |
| 7 | Column | `categories.bonus_badge_icon_url` | Custom bonus badge icon |
| 8 | Column | `categories.sp_earning_multiplier` | SP earning rate (1.05-1.40) |
| 9 | Column | `categories.sp_spending_cap_percent` | Max SP spending % (50-80) |
| 10 | Column | `categories.sp_config_notes` | Admin notes on SP rates |
| 11 | Column | `categories.sp_rate_change_notify` | Trigger notification flag |
| 12 | Table | `category_suggestions` | Seller-requested categories |
| 13 | Function | `update_category_item_count()` | Trigger: sync item counts |
| 14 | Trigger | `update_category_item_count_trigger` | Auto-update on item changes |
| 15 | RPC | `reorder_categories()` | Batch display_order update |
| 16 | Indexes | `idx_categories_active` | Active category queries |
| 17 | Indexes | `idx_categories_item_count` | Item count sorting |
| 18 | Indexes | `idx_categories_bonus` | Bonus category queries |

---

### **Backend Services (17 functions)**

| # | Function | Module | Purpose |
|---|----------|--------|---------|
| 1 | `createCategory()` | CategoryService | Create new category |
| 2 | `updateCategory()` | CategoryService | Update category fields |
| 3 | `deleteCategory()` | CategoryService | Delete category (if empty) |
| 4 | `getCategoriesWithCounts()` | CategoryService | Fetch all with item counts |
| 5 | `toggleCategoryActive()` | CategoryService | Activate/deactivate category |
| 6 | `reorderCategories()` | CategoryService | Batch update display_order |
| 7 | `getCategorySuggestions()` | CategorySuggestionService | Fetch pending suggestions |
| 8 | `approveCategorySuggestion()` | CategorySuggestionService | Approve + create category |
| 9 | `rejectCategorySuggestion()` | CategorySuggestionService | Reject suggestion |
| 10 | `mergeCategorySuggestion()` | CategorySuggestionService | Merge to existing category |
| 11 | `calculateCategorySP()` | SPConfigService | Calculate earn/spend SP for category |
| 12 | `getBonusCategories()` | SPConfigService | Fetch bonus categories (>1.10x) |
| 13 | `updateCategorySPRates()` | SPConfigService | Update SP earning/spending rates |
| 14 | `uploadCategoryIcon()` | CategoryService | Upload custom icon to storage |
| 15 | `getSPAnalyticsByCategory()` | SPConfigService | SP health metrics per category |

---

### **Utilities (2 functions)**

| # | Function | Purpose |
|---|----------|---------|
| 16 | `validateCategoryName()` | Name validation logic |
| 17 | `checkCategoryUniqueness()` | Duplicate check query |

---

### **Admin Portal Components (38 functions)**

#### **CategoryManagementPage (5 functions)**

| # | Function | Purpose |
|---|----------|---------|
| 13 | `loadCategories()` | Fetch all categories |
| 14 | `switchTab(tab)` | Switch between Categories/Suggestions tabs |
| 15 | `handleSearch(query)` | Filter categories by name |
| 16 | `handleFilterChange(filter)` | Apply Active/Inactive filter |
| 17 | `handleRefresh()` | Reload data |

---

#### **CategoryTable (12 functions)**

| # | Function | Purpose |
|---|----------|---------|
| 18 | `handleRowDragStart(id)` | Start drag operation |
| 19 | `handleRowDrop(fromIdx, toIdx)` | Reorder on drop |
| 20 | `handleBulkSelect(ids)` | Select multiple rows |
| 21 | `handleInlineEdit(id, field, value)` | Edit name inline |
| 22 | `handleToggleActive(id, isActive)` | Toggle active switch |
| 23 | `handleEdit(id)` | Open edit modal |
| 24 | `handleDelete(id)` | Delete category (if empty) |
| 25 | `handleSort(column)` | Sort by column |
| 26 | `validateBeforeDelete(id)` | Check item_count before delete |
| 27 | `exportToCSV(categories)` | Download CSV |
| 28 | `handleSPInlineEdit(id, field, value)` | Edit SP rates inline |
| 29 | `showSPPreview(categoryId, samplePrice)` | Hover preview calculator |

---

#### **CategoryForm (8 functions)**

| # | Function | Purpose |
|---|----------|---------|
| 30 | `handleSubmit(data)` | Create or update category |
| 31 | `handleNameChange(value)` | Validate + check uniqueness |
| 32 | `handleIconSelect(icon)` | Set emoji or icon |
| 33 | `handleIconUpload(file)` | Upload custom icon |
| 34 | `handleBadgeUpload(file)` | Upload custom bonus badge |
| 35 | `handleSPRateChange(field, value)` | Update SP earning/spending |
| 36 | `updateSPPreview()` | Recalculate preview example |
| 37 | `handleCancel()` | Close modal without saving |
| 38 | `resetForm()` | Clear form fields |

---

#### **CategorySuggestionsList (5 functions)**

| # | Function | Purpose |
|---|----------|---------|
| 39 | `loadSuggestions()` | Fetch pending suggestions |
| 40 | `handleApprove(suggestionId)` | Open create form with pre-filled name |
| 41 | `handleMerge(suggestionId, categoryId)` | Reassign item to existing category |
| 42 | `handleReject(suggestionId, note)` | Reject suggestion with note |
| 43 | `handleViewItem(itemId)` | Open item detail in new tab |

---

#### **SPAnalyticsDashboard (6 functions)**

| # | Function | Purpose |
|---|----------|---------|
| 44 | `loadSPAnalytics(dateRange)` | Fetch SP metrics by category |
| 45 | `handleDateRangeChange(range)` | Update analytics timeframe |
| 46 | `calculateVelocity(earned, spent)` | Compute earn/spend ratio |
| 47 | `detectAnomalies()` | Flag categories needing attention |
| 48 | `exportAnalyticsCSV()` | Download SP metrics report |
| 49 | `handleCategoryClick(categoryId)` | Navigate to category edit |

---

#### **BulkActionsDropdown (4 functions)**

| # | Function | Purpose |
|---|----------|---------|
| 50 | `handleBulkActivate(ids)` | Activate selected categories |
| 51 | `handleBulkDeactivate(ids)` | Deactivate selected categories |
| 52 | `handleBulkDelete(ids)` | Delete selected (if all empty) |
| 53 | `handleBulkExport(ids)` | Export selected to CSV |

---

**Total Admin Portal Functions:** 53  
**Total Project Functions:** 17 (backend) + 2 (utilities) + 53 (admin portal) = **72 functions**  
**Total Database Objects:** 18

---

---

#### **BulkActionsDropdown (3 functions)**

| # | Function | Purpose |
|---|----------|---------|
| 38 | `handleBulkActivate(ids)` | Activate selected categories |
| 39 | `handleBulkDeactivate(ids)` | Deactivate selected categories |
| 40 | `handleBulkDelete(ids)` | Delete selected (if all empty) |

---

## Component Specifications

### **CategoryTable**

```
┌───────────────────────────────────────────────────────────┐
│ ☰  ☑  Icon  Name              Item Count  Status  Actions │
├───────────────────────────────────────────────────────────┤
│ ☰  ☐  🧸   Toys & Games       23          Active   ✏️ 🗑️  │
│ ☰  ☐  👗   Clothing            45          Active   ✏️ 🗑️  │
│ ☰  ☐  📚   Books                8          Active   ✏️ 🗑️  │
│ ☰  ☐  🎮   Games                0         Inactive  ✏️ 🗑️  │
│ ☰  ☐  ❓   Other               12          Active   ✏️ 🗑️  │
└───────────────────────────────────────────────────────────┘
[1-5 of 23]  < 1 2 3 >
```

**Drag Handle (☰):**
- Long press or click-hold to enter drag mode
- Drag row up/down to reorder
- Drop updates `display_order` immediately

**Status Toggle:**
- Switch component (Active/Inactive)
- Inline toggle (no modal)
- Shows confirmation if `item_count > 0`

---

### **CategorySuggestionsList**

```
┌─────────────────────────────────────────────────────────────┐
│ Suggested Name  │ Item         │ Seller    │ Date   │ Actions│
├─────────────────────────────────────────────────────────────┤
│ Board Games     │ Monopoly Jr. │ John D.   │ 4/18   │ ✅ 🔀 ❌│
│ Outdoor Toys    │ Slide        │ Sarah K.  │ 4/17   │ ✅ 🔀 ❌│
│ Baby Gear       │ Stroller     │ Mike L.   │ 4/16   │ ✅ 🔀 ❌│
└─────────────────────────────────────────────────────────────┘
```

**Action Buttons:**
- ✅ **Approve** → Opens CategoryForm with name pre-filled
- 🔀 **Merge** → Opens dropdown: "Select existing category to merge into"
- ❌ **Reject** → Opens modal: "Reason for rejection (optional)"

---

### **Approve Flow (Modal)**

```
┌─────────────────────────────────────┐
│  Approve Category Suggestion  [✕]   │
├─────────────────────────────────────┤
│  Suggested by seller: "Board Games" │
│                                     │
│  Name *                             │
│  ┌──────────────────────────────┐   │
│  │ Board Games                  │   │
│  └──────────────────────────────┘   │
│                                     │
│  Description                        │
│  ┌──────────────────────────────┐   │
│  │ Games for kids and families  │   │
│  └──────────────────────────────┘   │
│                                     │
│  Icon                               │
│  ┌──────────────────────────────┐   │
│  │ 🎲                           │   │
│  └──────────────────────────────┘   │
│                                     │
│  ☑ Active (show immediately)        │
│                                     │
│  [Cancel]      [Create & Reassign]  │
└─────────────────────────────────────┘
```

---

## Performance Requirements

| Metric | Target | Method |
|--------|--------|--------|
| Category table load | < 300ms | Indexed queries + pagination |
| Category create | < 500ms | Optimistic update |
| Category update | < 300ms | Optimistic update |
| Drag-and-drop reorder | < 200ms | Optimistic + batch RPC |
| Item count refresh | Real-time | Trigger auto-updates |
| Suggestion approval | < 1s | Transaction (create + reassign) |
| Bulk activate/deactivate | < 2s for 50 | Batch update RPC |
| Buyer category load | < 300ms | Cached + indexed |
| SP calculation per item | < 50ms | Indexed query on category |
| SP analytics dashboard | < 1s | Pre-aggregated metrics |
| Icon upload to storage | < 2s | Direct Supabase Storage upload |
| Bonus category query | < 100ms | Indexed on sp_earning_multiplier |

---

## Accessibility Requirements

- All interactive elements: `accessibilityLabel` + `accessibilityHint`
- Drag handles: announce "Reorder category, draggable"
- Table headers: sortable announced ("Sort by Name, button")
- Active/Inactive toggle: announced state ("Active, switch button")
- Bulk select checkboxes: announced count ("3 categories selected")
- Modal forms: focus trap + keyboard navigation
- Error messages: announced by screen reader immediately
- Success toasts: announced ("Category created successfully")
- Confirmation modals: focus on primary action
- SP rate sliders: announced value + range ("1.20×, range 1.05 to 1.40")
- SP preview calculator: announced SP amounts ("Earn 55 SP, spend up to 35 SP")
- Bonus badge icons: alt text ("Bonus category")
- Icon upload: announced file type validation errors

---

## Testing Requirements

### **Unit Tests**

| Test | Location | Coverage |
|------|----------|---------|
| `validateCategoryName()` | `__tests__/utils/categoryValidation.test.ts` | Valid/invalid names, edge cases |
| `checkCategoryUniqueness()` | `__tests__/services/categoryService.test.ts` | Duplicate check, case-insensitive |
| `createCategory()` | `__tests__/services/categoryService.test.ts` | Success, duplicate error |
| `deleteCategory()` | `__tests__/services/categoryService.test.ts` | Success (empty), error (has items) |
| `calculateCategorySP()` | `__tests__/services/spConfigService.test.ts` | Various multipliers (1.05-1.40), spending caps (50-80%) |
| `updateCategorySPRates()` | `__tests__/services/spConfigService.test.ts` | Valid ranges, out-of-range rejection, notification trigger |
| `getBonusCategories()` | `__tests__/services/spConfigService.test.ts` | Filters only >1.10x, correct ordering |
| `uploadCategoryIcon()` | `__tests__/services/categoryService.test.ts` | File validation (type, size, dimensions) |
| `getSPAnalyticsByCategory()` | `__tests__/services/spConfigService.test.ts` | Velocity, gap, cash flow calculations |
| `update_category_item_count trigger` | SQL test | Insert/update/delete item → count updates |
| `reorder_categories()` RPC | SQL test | Batch display_order update |

### **Integration Tests**

| Test | Supabase | Description |
|------|----------|-------------|
| Category CRUD lifecycle | Prod staging | Create → update → deactivate → delete |
| Category suggestion approval | Prod staging | Suggest → approve → verify category + item reassignment |
| Bulk deactivate | Prod staging | Select 5 → deactivate → verify all inactive |
| Item count auto-update | Prod staging | Add item → verify count++, delete item → verify count-- |
| SP calculation accuracy | Prod staging | Create category with 1.30×, list item, verify SP = price × 1.30 |
| SP spending cap enforcement | Prod staging | Category with 60% cap, attempt 70% SP → error, attempt 60% → success |
| Icon upload persistence | Prod staging | Upload PNG icon → verify URL saved, reload → verify icon displays |
| Bonus category filtering | Prod staging | Set 3 categories >1.10×, query getBonusCategories() → verify 3 returned |

### **Maestro UI Flow Tests (Admin Portal)**

| Flow | File | States Covered |
|------|------|---------------|
| Category create | `.maestro/admin-category-create.yaml` | Open modal, fill form, submit, verify in table |
| Category edit | `.maestro/admin-category-edit.yaml` | Click edit, change name, save, verify |
| Category suggestion approve | `.maestro/admin-suggestion-approve.yaml` | Open suggestion, approve, verify new category |
| Drag-and-drop reorder | `.maestro/admin-category-reorder.yaml` | Drag row, verify new order |
| Bulk deactivate | `.maestro/admin-bulk-deactivate.yaml` | Select 3, deactivate, verify all inactive |
| SP rate configuration | `.maestro/admin-sp-config.yaml` | Edit category, navigate to SP tab, change rates, preview updates |
| Icon upload | `.maestro/admin-icon-upload.yaml` | Upload category icon, upload bonus badge, verify both display |
| SP analytics dashboard | `.maestro/admin-sp-analytics.yaml` | Load dashboard, change date range, verify metrics update |

---

## Acceptance Criteria

### **AC-001: Admin Category CRUD**
- [ ] Admin can create category via UI form
- [ ] Admin can edit category name, description, icon
- [ ] Admin can deactivate category (soft delete)
- [ ] Admin can delete category only if `item_count = 0`
- [ ] Admin can reorder categories via drag-and-drop
- [ ] Changes reflected in buyer app within 1 minute (cache refresh)

### **AC-002: Category Item Counts**
- [ ] Each category shows live `item_count` in admin table
- [ ] Count updates automatically when items added/sold/deleted
- [ ] Buyer app shows count: "Toys (23)"
- [ ] Categories with 0 items hidden from buyer category modal

### **AC-003: Category Suggestions**
- [ ] Seller selects "Other" → enters text → suggestion created
- [ ] Admin sees suggestion in review queue
- [ ] Admin can approve → creates category + reassigns item
- [ ] Admin can merge → reassigns item to existing category
- [ ] Admin can reject → item stays in "Other" + note stored

### **AC-004: Bulk Actions**
- [ ] Admin can select multiple categories (checkboxes)
- [ ] Bulk activate/deactivate updates all selected
- [ ] Bulk delete only enabled if all selected have `item_count = 0`
- [ ] Confirmation modal shows count before action
- [ ] All bulk actions atomic (all succeed or all fail)

### **AC-005: Drag-and-Drop Reordering**
- [ ] Admin can drag category rows to reorder
- [ ] Drop updates `display_order` immediately (optimistic)
- [ ] Buyer app respects new order within 1 minute
- [ ] Reorder persists across page refreshes

### **AC-006: Active/Inactive Toggle**
- [ ] Toggling "Active" switch updates category immediately
- [ ] Inactive categories hidden from buyer flows
- [ ] Inactive categories shown in admin portal with "Inactive" badge
- [ ] Deactivating category with items shows warning

### **AC-007: SP Earning & Spending Configuration**
- [ ] Admin can set SP earning multiplier (1.05-1.40x) per category
- [ ] Admin can set SP spending cap (50-80%) per category
- [ ] SP rates validated on save (reject out-of-range values)
- [ ] Preview calculator shows accurate SP for sample prices
- [ ] SP rates persist and apply to all transactions in that category
- [ ] Default values (1.10x earn, 70% spend) applied to all categories at launch

### **AC-008: Bonus Category Icons & Badges**
- [ ] Categories with earning >1.10x display bonus badge (⭐ default)
- [ ] Admin can upload custom category icon (PNG/SVG, max 500KB)
- [ ] Admin can upload custom bonus badge icon
- [ ] Uploaded icons display in admin table and mobile app
- [ ] Icon upload validates file type and size before saving

### **AC-009: SP Analytics Dashboard**
- [ ] Admin can view SP velocity (earn/spend ratio) per category
- [ ] Admin can view SP gap (accumulation percentage) per category
- [ ] Admin can view average cash flow per category
- [ ] Dashboard flags categories with anomalies (hoarding, low velocity)
- [ ] Date range filter updates all metrics accurately
- [ ] Export to CSV includes all metrics and timestamps

### **AC-010: Category Rate Change Notifications**
- [ ] Admin can optionally trigger in-app notification when SP rates change
- [ ] Notification checkbox appears in category edit form
- [ ] Users receive banner notification if checkbox enabled
- [ ] Notification includes category name and new rates

---

## Out of Scope (Post-MVP)

| Feature | Reason |
|---------|--------|
| Nested subcategories | Data model complexity |
| Category merge tool (bulk reassign) | Low priority for MVP |
| Category analytics (views, conversions) | Phase 2 analytics track |
| Category templates | No clear use case yet |
| Category approval workflow (multi-level) | Overkill for MVP |
| Category aliases/synonyms | Search optimization (Phase 2) |
| Category translations | Internationalization (Phase 2) |
| Dynamic SP rate automation (ML-based) | Advanced feature for Phase 2 |
| Category-specific transaction fees | Finance model complexity |

---

## Implementation Checklist

### **Database**
- [ ] Run migration: `20260420000003_add_category_management_columns.sql`
- [ ] Run migration: create `category_suggestions` table
- [ ] Run migration: create `update_category_item_count()` trigger
- [ ] Run migration: create `reorder_categories()` RPC
- [ ] Run migration: add SP columns (sp_earning_multiplier, sp_spending_cap_percent, etc.)
- [ ] Run migration: add icon columns (icon_url, bonus_badge_icon_url)
- [ ] Run migration: add indexes (idx_categories_active, idx_categories_bonus, etc.)
- [ ] Verify FK constraints + RLS policies
- [ ] Verify indexes created correctly
- [ ] Run initial `item_count` computation
- [ ] Set default SP rates (1.10x earn, 70% spend) on all existing categories

### **Backend Services**
- [ ] Implement `CategoryService` (CRUD + toggle + reorder)
- [ ] Implement `CategorySuggestionService` (approve/reject/merge)
- [ ] Implement `SPConfigService` (calculateCategorySP, getBonusCategories, updateCategorySPRates, getSPAnalyticsByCategory)
- [ ] Implement `uploadCategoryIcon()` (category icon + bonus badge upload)
- [ ] Implement `validateCategoryName()` utility
- [ ] Implement `checkCategoryUniqueness()` utility
- [ ] Implement SP rate validation (1.05-1.40 earn, 50-80% spend)

### **Admin Portal**
- [ ] Build `CategoryManagementPage` layout
- [ ] Build `CategoryTable` with drag-and-drop + SP columns
- [ ] Build `CategoryForm` modal with 3 tabs (Basic Info, Icon & Badge, SP Config)
- [ ] Build `SPAnalyticsDashboard` component
- [ ] Build `CategorySuggestionsList` table
- [ ] Build `BulkActionsDropdown` component
- [ ] Implement SP rate inline editing in table
- [ ] Implement SP preview calculator in form
- [ ] Implement icon upload with validation
- [ ] Add navigation: Admin Dashboard → Settings → Categories
- [ ] Integrate all backend services
- [ ] Add "Bonus" filter tab to CategoryTable

### **Mobile App (Track 2 Integration)**
- [ ] Update `CategorySelectModal` to show item counts
- [ ] Filter out categories with `item_count = 0` from buyer flows
- [ ] Ensure "Other" option triggers `createCategorySuggestionFromItem()`
- [ ] Verify category list respects `display_order`
- [ ] Display bonus badge icon (⭐ or custom) for categories with >1.10x earning
- [ ] Integrate `calculateCategorySP()` in item listing and purchase flows
- [ ] Render custom category icons if uploaded
- [ ] Show in-app banner notification for SP rate changes (if admin enabled)

### **Tests**
- [ ] Unit tests: all utility + service functions
- [ ] Integration tests: CRUD lifecycle + suggestion approval
- [ ] SP calculation accuracy tests (various multipliers and caps)
- [ ] SP spending cap enforcement tests (max 70-80% depending on category)
- [ ] Icon upload validation tests (file type, size, dimensions)
- [ ] Bonus category filter tests
- [ ] SP analytics calculation tests
- [ ] Maestro flows: all 5 flows listed in Testing Requirements
- [ ] Manual testing per test cases file

### **Cross-Track Integration**
- [ ] Verify Track 1 (Search Filters) uses `getCategoriesWithCounts(includeInactive=false)`
- [ ] Verify Track 2 (Bulk Listing) uses same category service
- [ ] Confirm category counts update when items published from bulk upload
- [ ] Confirm "Other" flow works end-to-end (seller → admin review)
- [ ] Update Track 2 item listing to call `calculateCategorySP()` for SP preview
- [ ] Update Track 2 purchase checkout to enforce category spending cap
- [ ] Ensure bonus badges render correctly in category browse screens

---

*Document version: 2.0 | Last updated: April 21, 2026 | Next review: after SP configuration implementation*
