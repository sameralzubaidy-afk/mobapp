# Bulk Listing with AI Auto-Fill + Enhanced Single Item Create — Complete Requirements Document

**Project:** Kids P2P Marketplace  
**Feature:** Bulk Listing with AI Auto-Fill & Improved Item Creation UX  
**Version:** 1.0  
**Date:** April 19, 2026  
**Owner:** @sameralzubaidy-afk  
**Target Release:** Week 4-6 (MVP Track 2)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [UX Decisions & Competitor Benchmarks](#ux-decisions--competitor-benchmarks)
3. [User Stories](#user-stories)
4. [Database Schema Changes](#database-schema-changes)
5. [Backend Functions (RPCs & Services)](#backend-functions-rpcs--services)
6. [Edge Functions](#edge-functions)
7. [Frontend Architecture](#frontend-architecture)
8. [Complete Function Reference](#complete-function-reference)
9. [Component Specifications](#component-specifications)
10. [Performance Requirements](#performance-requirements)
11. [Accessibility Requirements](#accessibility-requirements)
12. [Testing Requirements](#testing-requirements)
13. [Acceptance Criteria](#acceptance-criteria)
14. [Out of Scope (Post-MVP)](#out-of-scope-post-mvp)
15. [Implementation Checklist](#implementation-checklist)

---

## Executive Summary

### **Problem Statement**

Current item creation has critical UX & productivity gaps:
- ❌ Text-first flow forces sellers to fill details before adding photos (backwards)
- ❌ No AI assistance → sellers manually fill category, condition, title, description from scratch
- ❌ No bulk creation → selling 10 items requires 10 separate flows (painful)
- ❌ Only 5 photos max (storage concern already noted — raised to 10)
- ❌ Missing structured fields: age_group, gender, brand, color (needed by Search filters in Track 1)
- ❌ No draft saving → accidental exit loses all progress
- ❌ No price guidance → sellers under-price or over-price

### **Solution Overview**

**Scope (Both in scope per decision Q1-B):**
1. **Enhanced Single Item Creation** — Photo-first flow with AI auto-fill
2. **Bulk Listing Creation** — Upload 30 photos → AI groups + auto-fills up to 15 items

**Phase 1 (MVP — Weeks 4-6):**
- ✅ Photo-first flow (single and bulk)
- ✅ AI auto-fill via Google Vision → title, category, condition, brand, color, age_group, gender
- ✅ Background AI processing (non-blocking, per decision Q3-C)
- ✅ AI suggestion card with "Apply" button (per decision Q5-B)
- ✅ Auto-grouping of bulk photos (2-3 per item, adjustable)
- ✅ Draft management (7-day persistence, auto-save)
- ✅ Price suggestion tiers with manual override
- ✅ Category "Other" fallback with text suggestion
- ✅ New fields: age_group, gender, brand, color (links to Track 1 Search Filters)
- ✅ Drag-and-drop image reordering
- ✅ Condition photo guide (real marketplace photos)
- ✅ Brand autocomplete (hybrid: predefined + DB)
- ✅ Category modal with search + recent categories

**Phase 2 (Post-MVP):**
- Video clips in listings
- AI-generated descriptions
- Multi-platform cross-posting
- Pricing history charts
- Location-based price suggestions

### **Success Metrics**

| Metric | Current | Target (MVP) |
|--------|---------|--------------|
| Time to create 1 listing | ~4 min | < 2 min |
| Time to create 10 listings | ~40 min | < 10 min |
| Listing completion rate | Unknown | > 75% |
| Draft abandonment recovery | 0% | > 30% |
| AI auto-fill accuracy | 0% | > 70% confidence |
| Price guidance adoption | 0% | Track post-launch |

---

## UX Decisions & Competitor Benchmarks

### **1. Flow Order: Photo-First**
**Decision (Q4-A):** Photos first, then details

**Rationale:**
- eBay, Facebook Marketplace, Depop, and Vinted all lead with photos
- Photos are the primary effort → completing them first gives momentum
- AI can pre-fill details from photos (reduces manual work)
- Parents take phone photos first anyway (natural mental model)

**Flow:**
```
[1] Add Photos → [2] AI Analyzes (background) → [3] Review AI Suggestions → [4] Fill/Edit Details → [5] Set Price → [6] Publish
```

---

### **2. AI Suggestion UI: Card with Apply Button**
**Decision (Q5-B):** Show AI suggestion card with "Apply" button

**Benchmark:**
| App | AI Fill Approach |
|-----|-----------------|
| eBay | Auto-fills fields + green "AI Suggested" badge |
| Depop | Category auto-suggest with confidence % |
| Whatnot | Title suggestion below photo |
| **Kids Marketplace** | **Suggestion card above form with "Apply All" or per-field "Use"** |

**UI Pattern:**
- Card appears above form when AI completes analysis
- Shows: Title, Category, Condition, Brand suggestions
- Each field has "Use ↓" micro-button
- "Apply All" button for one-tap fill
- Card is dismissible
- Low-confidence fields show visual prompt: "Tap to fill in [field]" (dashed border)

---

### **3. AI Processing: Background (Non-Blocking)**
**Decision (Q3-C):** Start AI analysis immediately after photo upload; user can start filling in form while AI runs

**Implementation:**
- Photo upload → immediately show form with empty/placeholder fields
- AI analysis runs in background (edge function call)
- When analysis completes: slide in suggestion card from top
- If user already filled a field manually: don't overwrite (offer as alternative)
- Progress indicator: subtle pulsing AI icon in corner while processing

---

### **4. Bulk Listing: Auto-Grouping**
**Decision (Q2 — Auto-only):** System automatically groups photos into items (2-3 per item, adjustable)

**Benchmark:**
| App | Bulk Upload Approach |
|-----|---------------------|
| Depop | Add 1-4 photos per listing manually |
| eBay | Up to 24 photos per listing, all manual |
| Facebook Marketplace | Single item per listing, no bulk |
| **Kids Marketplace** | **Auto-group 30 photos → up to 15 items, drag to reassign** |

**Grouping Algorithm:**
1. Upload all photos
2. Auto-group sequentially (every 2 photos = 1 item by default)
3. User can drag photos between groups before AI starts
4. Confirm grouping → AI analyzes each group independently
5. Results in item card stack (side-scroll or vertical list)

**Limits (per decisions):**
- 10 photos max per item
- 30 photos max per bulk session
- Up to 15 items per bulk upload

---

### **5. New Fields: All Items**
**Decision (Q6-A):** Add age_group, gender, brand, color to all items (not just clothing)

**These fields are critical for Track 1 Search Filters — must be consistent.**

| Field | Type | Values |
|-------|------|--------|
| age_group | TEXT (enum) | '0-2', '3-5', '6-8', '9-12', '13+' |
| gender | TEXT (enum) | 'boy', 'girl', 'unisex' |
| brand | TEXT | Free text + autocomplete (max 100 chars) |
| color | TEXT[] | Multi-select from 12 predefined colors |

---

### **6. Category Selection: Modal with Search**
**Decision (Q7-A):** Category selector opens full-screen modal with search + recent categories

**Benchmark:**
| App | Category UX |
|-----|------------|
| eBay | Drill-down tree (3 levels) |
| Depop | Grid of icons |
| Facebook | Single-level grid |
| **Kids Marketplace** | **Modal with search, grid icons, recent categories (last 3 used)** |

**Features:**
- Search bar inside modal (filters category list)
- Recent categories shown first (max 3)
- "Other" option at bottom with text input for custom suggestion
- selected category stored; custom suggestion stored in `requested_category_name`

---

### **7. Price Suggestions: 4 Tiers + Manual**
**Decision (Q8-A+E):** Show 4 price tiers + allow fully manual entry

**Tier Logic (based on condition):**
| Tier | Condition | Multiplier (of avg market price) |
|------|-----------|----------------------------------|
| Great Deal | Used/Worn | 40-50% |
| Fair Price | Good | 55-65% |
| Asking Price | Like New | 70-80% |
| Almost New | New/NWOT | 85-95% |

**If market data unavailable:** Show manual entry field only (no empty tier cards)

**UI:**
- 4 large tap-friendly cards in horizontal scroll
- Selected card highlighted in brand color
- Manual input field always visible below cards
- "How we calculate" info icon (links to FAQ)

---

### **8. Draft Auto-Save**
**Decision (Q9-B):** Auto-save every 30 seconds + on navigation away (hidden from user)

**Rules:**
- Drafts expire after 7 days (per decision on persistence)
- Max 5 drafts per user (LRU eviction)
- Draft visible on "Your Listings" screen under "Drafts" tab
- Banner on app open: "You have [N] unfinished listing(s). Continue?"
- Bulk upload saved as single draft (all items in one draft session)

---

### **9. Condition Guide: Photo Examples**
**Decision (Q10-A):** Show real marketplace photos as condition reference

**Conditions:**
| Condition Code | Label | Description |
|----------------|-------|-------------|
| `new` | New | Unused, tags still on |
| `like_new` | Like New | Used once or twice, no visible wear |
| `good` | Good | Light use, minor wear |
| `fair` | Fair | Visible wear, still functional |
| `worn` | Worn | Heavy wear, clearly used |

**UI:** Tap condition label → shows photo examples overlay (real items from marketplace)

---

### **10. Image Reordering: Drag-and-Drop**
**Decision (Q11-A):** Drag-and-drop reordering within item

**Implementation:**
- First photo = cover photo (marked with "Cover" badge)
- Long press photo → enters drag mode
- Drag-and-drop to reorder
- For bulk: drag photos between item groups too
- Uses `react-native-draggable-flatlist` or similar library

---

### **11. Separate Screens**
**Decision (Q14-A):** Two separate screens: BulkListingCreateScreen and ItemCreateScreen (enhanced)

**Navigation:**
- "Sell" tab FAB → bottom sheet with two options:
  - "List One Item" → ItemCreateScreen
  - "Bulk Upload" → BulkListingCreateScreen

---

### **12. AI Fallback: Partial Results**
**Decision (Q15-B):** Show partial AI results; invite user to fill blanks visually

**Rules:**
- Fields with confidence > 70%: auto-suggested in card
- Fields with confidence 40-70%: shown with "Maybe?" label
- Fields with confidence < 40%: shown as empty with dashed border prompt
- If AI completely fails: show empty form + "AI couldn't analyze this photo. Try a clearer photo or fill in manually."

---

### **13. Category "Other" Handling**
**Decision:** "Other" category option + text input for suggested category name

**Flow:**
- User selects "Other" in category modal
- Text field appears: "What is this item? (optional)"
- Entered text stored in `items.requested_category_name`
- Admin review flagged automatically via existing review flag system
- Admin sees suggested category highlighted in item review view

---

## User Stories

### **US-101: Photo-First Single Listing**
**As a** parent who wants to sell one item  
**I want** to start by adding photos  
**So that** the AI can help fill in details and I don't have to start with a blank form

**Acceptance Criteria:**
- Tapping "List One Item" opens camera/photo picker immediately
- Must add at least 1 photo to proceed
- AI analysis starts automatically after photo upload
- AI suggestions appear in a card within 5 seconds
- Can apply AI suggestions with single tap

---

### **US-102: Bulk Listing Upload**
**As a** parent with 10 kids' items to sell  
**I want** to upload multiple photos and let the app group them into listings  
**So that** I can create 10 listings in one session without doing each separately

**Acceptance Criteria:**
- Can select up to 30 photos in one session
- App auto-groups into items (2 photos per item default)
- Can see all grouped items in a horizontal scroll
- Can drag photos between groups to adjust
- AI analyzes each group separately
- Can publish all items with one "Publish All" tap (or review each first)

---

### **US-103: AI Auto-Fill Suggestion**
**As a** seller uploading an item  
**I want** the AI to suggest title, category, and condition  
**So that** I spend less time filling in details manually

**Acceptance Criteria:**
- After photo upload, AI suggestion card appears above form
- Card shows: Title, Category, Condition suggestions
- "Apply All" fills all fields at once
- Individual "Use" buttons apply per field
- Already-filled fields are not overwritten
- Card is dismissible

---

### **US-104: Draft Recovery**
**As a** seller interrupted while creating a listing  
**I want** my progress saved automatically  
**So that** I don't lose work if I get a phone call or close the app

**Acceptance Criteria:**
- Progress auto-saved every 30 seconds
- On next app open: banner shows "Resume your listing"
- Tapping banner opens draft exactly where left off
- Draft includes uploaded photos
- Drafts expire after 7 days with "Draft expired" notice

---

### **US-105: Price Guidance**
**As a** new seller unsure of pricing  
**I want** price suggestions based on the item's condition and category  
**So that** I price competitively and sell faster

**Acceptance Criteria:**
- 4 price tier cards shown after condition is selected
- Tapping tier fills price field
- Can override with manual input at any time
- If no market data: shows manual input only (no empty tier cards)
- "How we calculate" link available

---

### **US-106: Category Search Modal**
**As a** seller browsing categories  
**I want** to search for a category instead of scrolling  
**So that** I find the right category quickly

**Acceptance Criteria:**
- Tapping category field opens full-screen modal
- Modal has search bar at top
- Recent 3 categories shown first
- Type to filter category list
- "Other" at bottom with text input
- Single tap selects and closes modal

---

### **US-107: Condition Photo Guide**
**As a** new seller unsure how to rate condition  
**I want** to see photo examples of each condition level  
**So that** I rate accurately and buyers trust my listings

**Acceptance Criteria:**
- Tapping any condition label shows real-photo overlay
- Each condition shows 2-3 real marketplace photos
- Overlay dismissible
- Photos load quickly (< 1s)

---

### **US-108: New Attribute Fields (Track 1 Integration)**
**As a** buyer using search filters  
**I want** items to have age group, gender, brand, and color data  
**So that** the filters I set in search show relevant results

**Acceptance Criteria:**
- All item create/edit forms include age_group, gender, brand, color fields
- AI populates these fields when detectable
- Fields optional (not blocking publish)
- Data flows correctly to search_listings RPC

---

### **US-109: Brand Autocomplete**
**As a** seller typing a brand name  
**I want** autocomplete suggestions  
**So that** I enter brands consistently (no "lego" vs "LEGO" mismatch)

**Acceptance Criteria:**
- After 2 characters typed: shows up to 8 brand suggestions
- Suggestions from predefined list + existing DB brands
- Selecting suggestion auto-capitalizes correctly
- Can type any brand not in list

---

### **US-110: Bulk Publish or Review**
**As a** seller who bulk uploaded 10 items  
**I want** to review each item's AI-filled details before publishing  
**So that** I make sure all listings are accurate

**Acceptance Criteria:**
- Horizontal item card stack shows all items
- Tapping item card opens edit view for that item
- "Publish All" button with count: "Publish 10 items"
- Can exclude specific items from bulk publish
- Confirmation screen shows summary before publish

---

## Database Schema Changes

### **Migration 1: Add New Columns to Items Table**

**File:** `supabase/migrations/20260420000002_add_bulk_listing_columns.sql`

```sql
-- ================================================================
-- Migration: Add Bulk Listing & AI Fill Columns
-- Date: 2026-04-20
-- Description: Adds bulk_upload_id, requested_category_name to items
--              Note: age_group, gender, brand, color added in
--              migration 20260420000001_add_item_filter_columns.sql (Track 1)
-- ================================================================

-- Add bulk upload tracking column
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS bulk_upload_id UUID REFERENCES item_bulk_uploads(id) ON DELETE SET NULL;

-- Add category suggestion column (for "Other" category flow)
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS requested_category_name TEXT
    CHECK (LENGTH(requested_category_name) <= 100);

-- Index for admin review of category suggestions
CREATE INDEX IF NOT EXISTS idx_items_requested_category
  ON items(requested_category_name)
  WHERE requested_category_name IS NOT NULL;

-- Index for bulk upload grouping
CREATE INDEX IF NOT EXISTS idx_items_bulk_upload_id
  ON items(bulk_upload_id)
  WHERE bulk_upload_id IS NOT NULL;

COMMENT ON COLUMN items.bulk_upload_id IS 'Groups items created in same bulk upload session';
COMMENT ON COLUMN items.requested_category_name IS 'Seller-suggested category when "Other" selected; triggers admin review';
```

---

### **Migration 2: Create item_bulk_uploads Table**

```sql
-- ================================================================
-- Migration: Create item_bulk_uploads Table
-- ================================================================

CREATE TABLE IF NOT EXISTS public.item_bulk_uploads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'partial', 'failed')),
  total_photos    INT NOT NULL DEFAULT 0,
  total_items     INT NOT NULL DEFAULT 0,
  published_items INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,

  CONSTRAINT bulk_uploads_items_check CHECK (total_items <= 15),
  CONSTRAINT bulk_uploads_photos_check CHECK (total_photos <= 30)
);

-- RLS
ALTER TABLE public.item_bulk_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Seller can manage own bulk uploads"
  ON public.item_bulk_uploads
  FOR ALL
  USING (seller_id = auth.uid());

CREATE POLICY "Admin can view all bulk uploads"
  ON public.item_bulk_uploads
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

COMMENT ON TABLE public.item_bulk_uploads IS 'Tracks bulk upload sessions for grouping related items';
```

---

### **Migration 3: Create item_drafts Table**

```sql
-- ================================================================
-- Migration: Create item_drafts Table
-- Date: 2026-04-20
-- Description: Stores auto-saved item creation drafts
-- ================================================================

CREATE TABLE IF NOT EXISTS public.item_drafts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bulk_upload_id  UUID REFERENCES item_bulk_uploads(id) ON DELETE CASCADE,
  draft_data      JSONB NOT NULL DEFAULT '{}',
  photo_urls      TEXT[] NOT NULL DEFAULT '{}',
  ai_suggestions  JSONB,
  step            TEXT NOT NULL DEFAULT 'photos'
    CHECK (step IN ('photos', 'grouping', 'details', 'price', 'review')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days')
);

-- RLS
ALTER TABLE public.item_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Seller can manage own drafts"
  ON public.item_drafts
  FOR ALL
  USING (seller_id = auth.uid());

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_item_drafts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER item_drafts_updated_at
  BEFORE UPDATE ON public.item_drafts
  FOR EACH ROW EXECUTE FUNCTION update_item_drafts_updated_at();

-- Index for seller lookup + expiry cleanup
CREATE INDEX IF NOT EXISTS idx_item_drafts_seller_id
  ON item_drafts(seller_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_item_drafts_expires_at
  ON item_drafts(expires_at);

-- Enforce max 5 drafts per user (trigger)
CREATE OR REPLACE FUNCTION enforce_max_drafts()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete oldest drafts beyond limit of 5
  DELETE FROM public.item_drafts
  WHERE seller_id = NEW.seller_id
    AND id NOT IN (
      SELECT id FROM public.item_drafts
      WHERE seller_id = NEW.seller_id
      ORDER BY updated_at DESC
      LIMIT 4
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_max_drafts_trigger
  AFTER INSERT ON public.item_drafts
  FOR EACH ROW EXECUTE FUNCTION enforce_max_drafts();

COMMENT ON TABLE public.item_drafts IS 'Auto-saved listing creation drafts. Expire after 7 days. Max 5 per seller.';
```

---

## Backend Functions (RPCs & Services)

### **Photo Management**

#### `uploadPhotoBatch(photos: File[], onProgress: (n: number) => void): Promise<string[]>`
- Validates each photo (type, size, dimensions)
- Compresses photos to target quality (max 1MB each)
- Uploads to Supabase Storage: `listings/{seller_id}/{timestamp}/`
- Returns array of public URLs
- Calls `onProgress` per-photo for progress bar
- **Error:** Partial upload supported — returns successful URLs + error list

#### `linkPhotosToItems(photoUrls: string[], itemGroups: ItemGroup[]): ItemGroup[]`
- Maps uploaded photo URLs to their assigned item groups
- Used after bulk photo grouping is confirmed
- Returns updated item groups with photo_urls field set

---

### **AI Analysis**

#### `analyzePhotosBatch(photoUrls: string[]): Promise<AIAnalysisResult[]>`
- Calls `batch-analyze-items` edge function
- Passes array of photo URLs (one per item group's primary photo)
- Returns array of `AIAnalysisResult` (one per item)
- Background: does NOT block form interaction

#### `parseAIResult(raw: GoogleVisionResponse): AIAnalysisResult`
- Extracts: title, category_id, condition, brand, color[], age_group, gender
- Calculates confidence scores per field
- Returns structured `AIAnalysisResult` object
- Fields with confidence < 40% set to null

#### `getAIConfidenceLevel(score: number): 'high' | 'medium' | 'low'`
- `>= 0.70` → 'high' (auto-suggest in card)
- `0.40 - 0.69` → 'medium' (show with "Maybe?" label)
- `< 0.40` → 'low' (show as empty with visual prompt)

---

### **Draft Management**

#### `createItemDraft(sellerId: string, initialData: Partial<DraftData>): Promise<ItemDraft>`
- Creates new draft in `item_drafts` table
- Returns draft with generated UUID
- Called on first photo upload (before AI completes)

#### `getItemDraft(draftId: string): Promise<ItemDraft | null>`
- Fetches draft by ID
- Returns null if expired or not found
- Used on "Resume listing" banner tap

#### `updateItemDraft(draftId: string, updates: Partial<DraftData>): Promise<void>`
- Partial update (JSONB merge) to draft_data
- Debounced: called max once per 30 seconds during active editing
- Also called on screen blur (navigation away)

#### `deleteDraft(draftId: string): Promise<void>`
- Hard delete from item_drafts
- Called after successful publish
- Called if user explicitly dismisses draft

#### `getActiveDrafts(sellerId: string): Promise<ItemDraft[]>`
- Returns all non-expired drafts for seller
- Ordered by updated_at DESC
- Used for "Resume" banner and drafts tab

#### `publishDraft(draftId: string): Promise<Item>`
- Validates draft data completeness
- Creates item record from draft
- Deletes draft on success
- Returns created item

#### `publishBulkDrafts(bulkUploadId: string, itemIds: string[]): Promise<BulkPublishResult>`
- Publishes multiple items from same bulk session
- Validates each item
- Returns: `{ published: number, failed: number, errors: Record<string, string> }`
- Partial success allowed (some items can fail without blocking others)

---

### **Pricing**

#### `getSuggestedPrice(categoryId: string, condition: string): Promise<PriceTier[]>`
- Queries avg sold price for same category+condition in last 90 days
- Returns 4 tiers: great_deal, fair_price, asking_price, almost_new
- Returns empty array if < 5 comparable items (triggers manual-only mode)

#### `getPriceTierLabel(tier: PriceTier): { label: string; description: string; icon: string }`
- Maps tier code to human-readable label, description, and emoji icon
- Used by PriceSuggestionCard component

---

### **Category**

#### `getCategories(includeOther?: boolean): Promise<Category[]>`
- Returns all active categories ordered by display_order
- Each category includes `item_count` (active items only)
- If `includeOther=true`, appends virtual "Other" entry at end
- Note: Detailed category CRUD is in ADMIN-CATEGORY-MANAGEMENT.md

#### `flagForCategoryReview(itemId: string, requestedName: string): Promise<void>`
- Sets `items.requested_category_name`
- Updates existing review_flag to include category suggestion context
- Admin sees in review queue

#### `getRecentCategories(sellerId: string): Promise<Category[]>`
- Returns last 3 categories used by this seller
- Stored in AsyncStorage: `@kids_marketplace:recent_categories_{sellerId}`
- Returns up to 3 results

---

### **Brands**

#### `getBrandSuggestions(query: string): Promise<string[]>`
- After >= 2 characters typed
- Merges predefined brands list + distinct brands from `items.brand` in DB
- Filters by query (case-insensitive startsWith)
- Returns max 8 results, deduplicated, alphabetically sorted

**Predefined Brands List (50 popular kids brands):**
```
LEGO, Nike, Carter's, OshKosh B'Gosh, Melissa & Doug, Fisher-Price,
Little Tikes, Barbie, Hot Wheels, Disney, Marvel, Star Wars, Pokemon,
Gap Kids, Old Navy, Target, Cat & Jack, H&M, Zara Kids, Gymboree,
Graco, Chicco, BabyBjörn, Ergobaby, Skip Hop, Vans, Converse, Adidas,
Crayola, Play-Doh, Nerf, American Girl, Baby Einstein, VTech, LeapFrog,
Paw Patrol, Frozen, Minnie Mouse, Thomas & Friends, Sesame Street,
The North Face, Columbia, Patagonia, Ralph Lauren, Tommy Hilfiger,
Hanna Andersson, Mini Boden, Tea Collection, Primary, Lands' End
```

---

### **Condition Guide**

#### `getConditionGuide(): Promise<ConditionGuide[]>`
- Returns condition levels with labels, descriptions, and example photo URLs
- Photos sourced from real marketplace listings (curated)
- Cached in AsyncStorage for 24 hours

#### `getPopularColors(): string[]`
- Returns static list of 12 predefined colors
- No DB call needed
- `['Red', 'Blue', 'Green', 'Yellow', 'Pink', 'Purple', 'Black', 'White', 'Gray', 'Brown', 'Orange', 'Multicolor']`

---

### **Photo Utilities**

#### `validatePhoto(photo: Asset): ValidationResult`
- Checks: MIME type (jpeg/png/webp only), file size (< 10MB raw), dimensions (min 400x400px)
- Returns `{ valid: boolean; error?: string }`

#### `compressPhoto(uri: string, quality?: number): Promise<string>`
- Compresses to target quality (default 0.8)
- Max output size: 1MB
- Resizes if width > 1200px (preserves aspect ratio)
- Returns compressed URI

#### `groupPhotosAuto(photos: Asset[]): PhotoGroup[]`
- Sequential grouping: every 2 photos = 1 item
- Returns array of PhotoGroup with groupId
- Respects max 10 photos per group
- Respects max 30 total photos, 15 groups

#### `regroupPhotos(groups: PhotoGroup[], sourceGroupId: string, photoId: string, targetGroupId: string): PhotoGroup[]`
- Moves single photo between groups
- Maintains ordering within groups
- Returns updated groups array (immutable)

---

## Edge Functions

### **1. analyze-item-image (Existing — Enhance)**

**Path:** `supabase/functions/analyze-item-image/`  
**Current Status:** Exists — extend with new fields

**Enhancements Required:**
- Add extraction of: `age_group`, `gender`, `color[]`, `brand`
- Add confidence scores for all fields
- Return structured `AIAnalysisResult` type (not raw Vision response)
- Add error handling for rate limits (429 → retry with backoff)

**Request Payload:**
```typescript
{
  photoUrl: string;
  sellerId: string;
  requestFields: ('title' | 'category' | 'condition' | 'brand' | 'color' | 'age_group' | 'gender')[];
}
```

**Response Payload:**
```typescript
{
  title?: { value: string; confidence: number };
  category?: { value: string; categoryId: string; confidence: number };
  condition?: { value: string; confidence: number };
  brand?: { value: string; confidence: number };
  color?: { value: string[]; confidence: number };
  age_group?: { value: string; confidence: number };
  gender?: { value: string; confidence: number };
  rawLabels?: string[];
  error?: string;
}
```

---

### **2. batch-analyze-items (New)**

**Path:** `supabase/functions/batch-analyze-items/`

**Purpose:** Analyze multiple item photo groups in parallel for bulk upload

**Request Payload:**
```typescript
{
  items: Array<{
    groupId: string;
    primaryPhotoUrl: string;
    allPhotoUrls: string[];
  }>;
  sellerId: string;
}
```

**Response Payload:**
```typescript
{
  results: Array<{
    groupId: string;
    analysis: AIAnalysisResult;
    error?: string;
  }>;
  totalProcessed: number;
  totalFailed: number;
}
```

**Implementation Notes:**
- Calls `analyze-item-image` per item group in parallel (Promise.allSettled)
- Max concurrency: 5 parallel calls
- Timeout per item: 10 seconds
- Failed items return partial result (groupId + error), don't block others
- Returns partial results if some fail

---

## Frontend Architecture

### **Screen: ItemCreateScreen (Enhanced)**

**Path:** `p2p-kids-marketplace/src/screens/ItemCreateScreen.tsx`

**State Machine:**
```
IDLE → ADDING_PHOTOS → AI_ANALYZING → REVIEWING_SUGGESTIONS → FILLING_DETAILS → SETTING_PRICE → PUBLISHING → SUCCESS/ERROR
```

**Component Tree:**
```
ItemCreateScreen
├── PhotoUploadManager          ← Step 1: Photo upload + reorder
├── AIAnalysisCard              ← Appears when AI completes
├── ItemDetailsForm
│   ├── TitleInput
│   ├── CategorySelectModal     ← Opens on tap
│   ├── ConditionSelector       ← Condition guide trigger
│   ├── BrandAutocomplete
│   ├── ColorPicker (multi)
│   ├── AgeGroupSelector
│   └── GenderSelector
├── PriceSuggestionCard         ← Step 5: Pricing
│   ├── PriceTierCards
│   └── ManualPriceInput
└── PublishButton
```

---

### **Screen: BulkListingCreateScreen (New)**

**Path:** `p2p-kids-marketplace/src/screens/BulkListingCreateScreen.tsx`

**State Machine:**
```
IDLE → ADDING_PHOTOS → GROUPING → AI_ANALYZING → REVIEWING_ITEMS → PUBLISHING → SUCCESS/ERROR
```

**Component Tree:**
```
BulkListingCreateScreen
├── BulkPhotoUploader           ← Upload up to 30 photos
├── PhotoGroupingView           ← Drag photos between groups
│   └── PhotoGroupCard[]        ← One per item group
├── AIProgressIndicator         ← Shows per-item AI status
├── ItemCardStack               ← Horizontal scroll of items
│   └── BulkItemCard[]          ← Tap to expand + edit
│       ├── AIAnalysisCard
│       └── ItemDetailsForm
├── BulkPublishBar              ← Fixed bottom: "Publish 10 Items"
└── BulkPublishConfirmSheet     ← Summary before publish
```

---

## Complete Function Reference

### **Database (3 migrations, 7 objects)**

| # | Type | Object | Purpose |
|---|------|--------|---------|
| 1 | Column | `items.bulk_upload_id` | Group items from same bulk session |
| 2 | Column | `items.requested_category_name` | Store "Other" category suggestion |
| 3 | Table | `item_bulk_uploads` | Track bulk upload sessions |
| 4 | Table | `item_drafts` | Auto-saved listing drafts |
| 5 | Function | `update_item_drafts_updated_at()` | Trigger: auto-update timestamp |
| 6 | Function | `enforce_max_drafts()` | Trigger: limit 5 drafts per seller |
| 7 | Indexes | 6 indexes across tables | Query performance |

> **Note:** `age_group`, `gender`, `brand`, `color` columns added in Track 1 migration (SEARCH-FILTER-REQUIREMENTS.md Migration 1)

---

### **Backend Services (15 functions)**

| # | Function | Module | Purpose |
|---|----------|--------|---------|
| 1 | `uploadPhotoBatch()` | PhotoService | Upload photos with progress |
| 2 | `linkPhotosToItems()` | PhotoService | Map photos to item groups |
| 3 | `analyzePhotosBatch()` | AIService | Batch AI analysis trigger |
| 4 | `parseAIResult()` | AIService | Parse Vision API response |
| 5 | `getAIConfidenceLevel()` | AIService | Classify confidence score |
| 6 | `createItemDraft()` | DraftService | Create new draft |
| 7 | `getItemDraft()` | DraftService | Fetch draft by ID |
| 8 | `updateItemDraft()` | DraftService | Auto-save draft |
| 9 | `deleteDraft()` | DraftService | Delete after publish |
| 10 | `getActiveDrafts()` | DraftService | Resume banner / drafts tab |
| 11 | `publishDraft()` | DraftService | Single item publish |
| 12 | `publishBulkDrafts()` | DraftService | Bulk publish |
| 13 | `getSuggestedPrice()` | PricingService | 4-tier price suggestions |
| 14 | `getPriceTierLabel()` | PricingService | Tier display data |
| 15 | `getCategories()` | CategoryService | Load categories with counts |
| 16 | `flagForCategoryReview()` | CategoryService | Trigger admin review |
| 17 | `getRecentCategories()` | CategoryService | Recent 3 categories |
| 18 | `getBrandSuggestions()` | BrandService | Brand autocomplete |
| 19 | `getConditionGuide()` | ConditionService | Condition photo examples |
| 20 | `getPopularColors()` | ConditionService | 12 color list |

---

### **Photo Utilities (6 functions)**

| # | Function | Purpose |
|---|----------|---------|
| 21 | `validatePhoto()` | Type/size/dimension validation |
| 22 | `compressPhoto()` | Compress to < 1MB |
| 23 | `groupPhotosAuto()` | Sequential auto-grouping |
| 24 | `regroupPhotos()` | Drag photo between groups |
| 25 | `getPhotoThumbnail()` | Generate thumbnail URI |
| 26 | `getPhotoCount()` | Count photos across groups |

---

### **Edge Functions (2)**

| # | Function | Status | Purpose |
|---|----------|--------|---------|
| 27 | `analyze-item-image` | Existing — extend | Single item AI analysis |
| 28 | `batch-analyze-items` | New | Parallel bulk AI analysis |

---

### **Mobile App Components (62 functions)**

#### **PhotoUploadManager (8 functions)**

| # | Function | Purpose |
|---|----------|---------|
| 29 | `openPhotoPicker()` | Launch native photo picker |
| 30 | `openCamera()` | Launch camera |
| 31 | `addPhotos(assets)` | Add validated + compressed photos |
| 32 | `removePhoto(photoId)` | Remove individual photo |
| 33 | `reorderPhotos(fromIdx, toIdx)` | Drag-and-drop reorder |
| 34 | `setCoverPhoto(photoId)` | Set first/cover photo |
| 35 | `getUploadProgress()` | Return upload progress 0-100 |
| 36 | `clearAllPhotos()` | Reset photo list |

---

#### **AIAnalysisCard (6 functions)**

| # | Function | Purpose |
|---|----------|---------|
| 37 | `showCard(analysis)` | Animate card into view |
| 38 | `hideCard()` | Dismiss card |
| 39 | `applyAll(analysis)` | Apply all suggestions to form |
| 40 | `applyField(field, value)` | Apply single field suggestion |
| 41 | `getConfidenceBadge(score)` | Return badge UI for confidence level |
| 42 | `isFieldAlreadyFilled(field)` | Prevent overwrite check |

---

#### **CategorySelectModal (8 functions)**

| # | Function | Purpose |
|---|----------|---------|
| 43 | `openModal()` | Show category modal |
| 44 | `closeModal()` | Dismiss modal |
| 45 | `searchCategories(query)` | Filter category list |
| 46 | `selectCategory(category)` | Set selected + close |
| 47 | `selectOther()` | Show "Other" text input |
| 48 | `submitOtherCategory(name)` | Save custom suggestion |
| 49 | `loadRecentCategories()` | Load from AsyncStorage |
| 50 | `saveRecentCategory(category)` | Update AsyncStorage |

---

#### **PriceSuggestionCard (5 functions)**

| # | Function | Purpose |
|---|----------|---------|
| 51 | `loadPriceTiers(categoryId, condition)` | Fetch from getSuggestedPrice() |
| 52 | `selectTier(tier)` | Apply tier price to input |
| 53 | `setManualPrice(amount)` | Handle manual price input |
| 54 | `showHowWeCalculate()` | Open FAQ link/modal |
| 55 | `validatePrice(amount)` | Min/max price validation |

---

#### **DraftManager (8 functions)**

| # | Function | Purpose |
|---|----------|---------|
| 56 | `initDraft(type)` | Create new draft on first photo |
| 57 | `scheduleSave()` | Debounced 30s auto-save |
| 58 | `saveNow()` | Immediate save on nav away |
| 59 | `restoreDraft(draftId)` | Load draft state into form |
| 60 | `discardDraft(draftId)` | Delete + clear form |
| 61 | `checkForResumableDrafts()` | On app open, check for drafts |
| 62 | `showResumeBanner(drafts)` | Display resume prompt |
| 63 | `hideBanner()` | Dismiss resume banner |

---

#### **BulkListingCreateScreen (12 functions)**

| # | Function | Purpose |
|---|----------|---------|
| 64 | `startBulkSession()` | Create bulk_upload record |
| 65 | `addBulkPhotos(assets)` | Add all bulk photos (max 30) |
| 66 | `autoGroupPhotos()` | Run groupPhotosAuto() |
| 67 | `movePhotoBetweenGroups(...)` | Drag photo to different item |
| 68 | `confirmGrouping()` | Lock groups → start AI analysis |
| 69 | `startBulkAIAnalysis()` | Call analyzePhotosBatch() |
| 70 | `onAIResultPerItem(groupId, result)` | Update item card as AI completes |
| 71 | `editBulkItem(groupId)` | Open full edit view for one item |
| 72 | `excludeItemFromPublish(groupId)` | Toggle exclusion from batch |
| 73 | `reviewAllItems()` | Navigate to pre-publish review |
| 74 | `publishAll()` | Call publishBulkDrafts() |
| 75 | `handleBulkPublishResult(result)` | Show success/partial/error state |

---

#### **ItemCreateScreen Enhanced (15 functions)**

| # | Function | Purpose |
|---|----------|---------|
| 76 | `initCreateFlow()` | Setup screen state |
| 77 | `handlePhotosAdded(assets)` | Upload + start AI analysis |
| 78 | `onAIAnalysisComplete(result)` | Show AIAnalysisCard |
| 79 | `handleApplyAllAI()` | Fill form from AI suggestions |
| 80 | `handleFieldChange(field, value)` | Update form + auto-save |
| 81 | `openCategoryModal()` | Launch CategorySelectModal |
| 82 | `openConditionGuide()` | Show ConditionGuide overlay |
| 83 | `handleConditionSelect(condition)` | Set condition + load price tiers |
| 84 | `handlePriceSelect(price)` | Set price from tier or manual |
| 85 | `validateForm()` | Check required fields |
| 86 | `handlePublish()` | Final validation + publish |
| 87 | `handleSaveDraft()` | Manual draft save |
| 88 | `handleBack()` | Save draft on back navigation |
| 89 | `handleSuccess(item)` | Navigate to new listing |
| 90 | `handleError(error)` | Display error state |

---

## Component Specifications

### **PhotoUploadManager**

```
┌─────────────────────────────────────┐
│  + Add Photos (tap area)            │
│                                     │
│  ┌──────┐ ┌──────┐ ┌──────┐ + Add  │
│  │ IMG1 │ │ IMG2 │ │ IMG3 │        │
│  │Cover │ │      │ │      │        │
│  └──────┘ └──────┘ └──────┘        │
│                                     │
│  3/10 photos · Drag to reorder      │
└─────────────────────────────────────┘
```

- Cover badge on first photo
- Tap photo → remove or set as cover
- Long press → drag mode
- Progress bar during upload
- Photo count: `N/10 photos`

---

### **AIAnalysisCard**

```
┌─────────────────────────────────────┐
│ ✨ AI Suggestions          [Apply All]│
│─────────────────────────────────────│
│ Title:    LEGO City Police Car  [Use]│
│ Category: Toys & Games          [Use]│
│ Condition: Like New (85%)       [Use]│
│ Brand:    LEGO                  [Use]│
│                            [Dismiss] │
└─────────────────────────────────────┘
```

- Slides in from top when AI analysis completes
- "Apply All" fills all un-filled fields at once
- Per-field "Use" button applies individual suggestion
- Confidence shown for lower-confidence fields
- Dismissable (X or "Dismiss" button)
- Fields already filled by user: greyed out / "Already set"

---

### **CategorySelectModal**

```
┌─────────────────────────────────────┐
│  ✕  Select Category                 │
│  ┌──────────────────────────────┐   │
│  │ 🔍 Search categories...      │   │
│  └──────────────────────────────┘   │
│                                     │
│  RECENT                             │
│  ┌────────┐ ┌────────┐ ┌────────┐  │
│  │ Toys   │ │Clothes │ │ Books  │  │
│  └────────┘ └────────┘ └────────┘  │
│                                     │
│  ALL CATEGORIES                     │
│  ┌────────┐ ┌────────┐ ┌────────┐  │
│  │ Toys   │ │Clothes │ │ Books  │  │
│  │  (23)  │ │  (45)  │ │  (12)  │  │
│  └────────┘ └────────┘ └────────┘  │
│  ... [more categories]              │
│  ─────────────────────────────────  │
│  ┌──────────────────────────────┐   │
│  │ Other (suggest new category) │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

### **PriceSuggestionCard**

```
┌─────────────────────────────────────┐
│ 💰 Price Suggestions                │
│─────────────────────────────────────│
│ ┌───────┐ ┌───────┐ ┌───────┐ ┌───┐│
│ │Great  │ │ Fair  │ │Asking │ │ ≈  ││
│ │ Deal  │ │ Price │ │ Price │ │New ││
│ │ $8    │ │ $12   │ │ $15   │ │$19 ││
│ └───────┘ └───────┘ └───────┘ └───┘│
│                                     │
│ Or enter manually:                  │
│ ┌──────────────────────────────┐    │
│ │ $ ____                       │    │
│ └──────────────────────────────┘    │
│ ℹ️ How we calculate prices          │
└─────────────────────────────────────┘
```

---

### **BulkPhotoGroupingView**

```
┌─────────────────────────────────────┐
│ Group your photos into items        │
│                                     │
│ ← Item 1      Item 2      Item 3 →  │
│ ┌──────────┐ ┌──────────┐           │
│ │  Photo 1 │ │  Photo 3 │           │
│ │  Photo 2 │ │  Photo 4 │           │
│ └──────────┘ └──────────┘           │
│                   + Add Item Group  │
│                                     │
│ ✅ Confirm Grouping (3 items)        │
└─────────────────────────────────────┘
```

---

### **ConditionSelector with Guide**

```
┌─────────────────────────────────────┐
│ Condition                           │
│─────────────────────────────────────│
│ ○ New           What's this? 📸     │
│ ○ Like New      What's this? 📸     │
│ ● Good          What's this? 📸     │
│ ○ Fair          What's this? 📸     │
│ ○ Worn          What's this? 📸     │
└─────────────────────────────────────┘

[Condition Guide Overlay when 📸 tapped]
┌─────────────────────────────────────┐
│ ✕  "Good" Condition Examples        │
│─────────────────────────────────────│
│  [Photo 1]   [Photo 2]   [Photo 3]  │
│  Light scuff on corner              │
│  Still great condition overall      │
└─────────────────────────────────────┘
```

---

## Performance Requirements

| Metric | Target | Method |
|--------|--------|--------|
| Photo upload speed | < 2s per photo | Parallel upload + compression |
| AI analysis (single item) | < 5s (background) | Edge function + Vision API |
| AI analysis (bulk, 15 items) | < 30s (background) | Parallel edge function calls |
| Draft save | < 500ms | Optimistic update + background sync |
| Category modal open | < 200ms | Pre-loaded + cached |
| Brand autocomplete | < 300ms after 2 chars | Debounce 200ms + local first |
| Price tier load | < 300ms | Cached per category+condition |
| Publish (single) | < 2s | Optimistic navigation |
| Publish (bulk 15 items) | < 10s | Parallel inserts |

---

## Accessibility Requirements

- All interactive elements: `accessibilityLabel` + `accessibilityHint`
- Photo picker: voice-over friendly ("Add photo, button")
- Drag handles: large touch target (44x44pt minimum)
- AI suggestion card: announced when appears ("AI suggestions available")
- Condition guide: images have descriptive alt text
- Price tier cards: announce price + condition ("Great Deal, $8 button")
- Color picker: uses color name text, not color alone ("Pink button, selected")
- Error messages: announced by screen reader immediately
- Progress indicators: descriptive labels ("Uploading photo 2 of 5")

---

## Testing Requirements

### **Unit Tests**

| Test | Location | Coverage |
|------|----------|---------|
| `validatePhoto()` | `__tests__/utils/photoUtils.test.ts` | Valid/invalid types, sizes, dimensions |
| `compressPhoto()` | `__tests__/utils/photoUtils.test.ts` | Compression output size |
| `groupPhotosAuto()` | `__tests__/utils/photoUtils.test.ts` | Grouping logic, limits |
| `regroupPhotos()` | `__tests__/utils/photoUtils.test.ts` | Move between groups |
| `parseAIResult()` | `__tests__/services/aiService.test.ts` | Field extraction, confidence |
| `getAIConfidenceLevel()` | `__tests__/services/aiService.test.ts` | Score boundaries |
| `getSuggestedPrice()` | `__tests__/services/pricingService.test.ts` | Tier calculation, empty fallback |
| `getBrandSuggestions()` | `__tests__/services/brandService.test.ts` | Merge, deduplicate, sort |
| `enforce_max_drafts trigger` | SQL test | Max 5 per seller |
| `DraftManager.scheduleSave()` | `__tests__/hooks/useDraft.test.ts` | Debounce, nav-away save |

### **Integration Tests**

| Test | Supabase | Description |
|------|----------|-------------|
| Draft create + update + publish | Prod staging | Full draft lifecycle |
| Bulk upload session | Prod staging | Create session, link items |
| Category suggestion flag | Prod staging | "Other" flow → review flag |
| Photo upload to Storage | Prod staging | Upload + URL generation |
| publishBulkDrafts partial fail | Prod staging | 10 items, 2 fail → 8 succeed |

### **Maestro UI Flow Tests**

| Flow | File | States Covered |
|------|------|---------------|
| Single item create | `.maestro/item-create-flow.yaml` | Happy path, AI applied, no AI, draft resume |
| Bulk listing create | `.maestro/bulk-listing-flow.yaml` | Upload, group, AI, publish all |
| Draft recovery | `.maestro/draft-recovery-flow.yaml` | Create, exit, resume |
| Category "Other" | `.maestro/category-other-flow.yaml` | Select Other, submit name |
| Price selection | `.maestro/price-selection-flow.yaml` | Tier select, manual override |

---

## Acceptance Criteria

### **AC-001: Single Item Create — Photo-First Flow**
- [ ] Tapping "List One Item" opens photo picker as first step
- [ ] AI analysis starts automatically after first photo upload
- [ ] AI suggestion card appears within 5 seconds of upload
- [ ] "Apply All" fills title, category, condition in one tap
- [ ] Form still functional if AI fails (manual fill)

### **AC-002: Bulk Listing**
- [ ] Can select up to 30 photos in single picker session
- [ ] Photos auto-grouped into items (2 per item default)
- [ ] Visual grouping view shows all groups
- [ ] Can drag photos between groups
- [ ] AI analyzes each group independently (background)
- [ ] "Publish All" publishes all non-excluded items
- [ ] Partial publish succeeds even if some items fail

### **AC-003: Draft Auto-Save**
- [ ] Draft auto-saves every 30 seconds during editing
- [ ] Draft saves immediately when user navigates away
- [ ] On app open: banner shown if active draft exists
- [ ] Tapping banner resumes exact draft state
- [ ] Drafts expire after 7 days
- [ ] Max 5 drafts per seller (oldest evicted)

### **AC-004: AI Confidence Display**
- [ ] High confidence (>70%): shown in suggestion card
- [ ] Medium confidence (40-70%): shown with "Maybe?" label
- [ ] Low confidence (<40%): field shown empty with dashed border
- [ ] Total AI failure: empty form + helpful error message

### **AC-005: Price Suggestions**
- [ ] 4 tier cards load within 300ms of condition selection
- [ ] Tapping tier fills price field
- [ ] Manual price input always visible
- [ ] No tier cards shown if < 5 comparable sales data

### **AC-006: New Item Fields (Track 1 Integration)**
- [ ] age_group, gender, brand, color fields present on all item forms
- [ ] AI populates these fields when detectable
- [ ] Fields optional (can publish without)
- [ ] Values match enum constraints in DB

### **AC-007: Category "Other" Flow**
- [ ] "Other" option visible at bottom of category modal
- [ ] Selecting "Other" shows text input
- [ ] Submitted category name stored in `items.requested_category_name`
- [ ] Item automatically flagged for admin review

### **AC-008: Condition Guide**
- [ ] Tapping condition info icon shows photo overlay
- [ ] Each condition shows ≥ 2 real example photos
- [ ] Overlay dismissible by tap outside or X button

---

## Out of Scope (Post-MVP)

| Feature | Reason |
|---------|--------|
| AI-generated full descriptions | High LLM cost, Phase 2 |
| Video clips in listings | Storage/bandwidth cost |
| Cross-platform listing (Facebook, eBay) | Complex OAuth flows |
| Pricing history chart | Needs 3+ months of data |
| Location-based pricing | Requires geo permissions flow |
| AR try-on / background removal | Hardware dependent |
| Batch edit after publish | Low seller priority for MVP |
| Seller analytics per listing | Phase 2 analytics track |

---

## Implementation Checklist

### **Database**
- [ ] Run migration: `20260420000002_add_bulk_listing_columns.sql`
- [ ] Run migration: create `item_bulk_uploads` table
- [ ] Run migration: create `item_drafts` table with triggers
- [ ] Verify FK constraints + RLS policies
- [ ] Verify indexes created correctly

### **Edge Functions**
- [ ] Enhance `analyze-item-image` with new fields + confidence scores
- [ ] Create `batch-analyze-items` edge function
- [ ] Deploy both functions to production
- [ ] Add rate limit handling (429 retry with backoff)

### **Backend Services**
- [ ] Implement `PhotoService` (uploadPhotoBatch, linkPhotosToItems)
- [ ] Implement `AIService` (analyzePhotosBatch, parseAIResult, getAIConfidenceLevel)
- [ ] Implement `DraftService` (CRUD + publish functions)
- [ ] Implement `PricingService` (getSuggestedPrice, getPriceTierLabel)
- [ ] Implement `CategoryService` enhancements (getCategories with counts, flagForCategoryReview, getRecentCategories)
- [ ] Implement `BrandService` (getBrandSuggestions)
- [ ] Implement `ConditionService` (getConditionGuide, getPopularColors)

### **Photo Utilities**
- [ ] `validatePhoto()` — type/size/dimension checks
- [ ] `compressPhoto()` — compression + resize
- [ ] `groupPhotosAuto()` — sequential grouping
- [ ] `regroupPhotos()` — move photos between groups

### **Mobile App — ItemCreateScreen**
- [ ] Rebuild flow: photo-first, then details
- [ ] Integrate PhotoUploadManager component
- [ ] Integrate AIAnalysisCard component
- [ ] Add CategorySelectModal
- [ ] Add ConditionSelector with guide overlay
- [ ] Add BrandAutocomplete
- [ ] Add ColorPicker (multi-select, 12 colors)
- [ ] Add AgeGroupSelector
- [ ] Add GenderSelector
- [ ] Integrate PriceSuggestionCard
- [ ] Integrate DraftManager
- [ ] Update navigation (FAB → bottom sheet with two options)

### **Mobile App — BulkListingCreateScreen**
- [ ] Build BulkPhotoUploader (30 photos max)
- [ ] Build PhotoGroupingView with drag-and-drop
- [ ] Build ItemCardStack (horizontal scroll)
- [ ] Build BulkItemCard (collapsible)
- [ ] Build BulkPublishBar (fixed bottom)
- [ ] Build BulkPublishConfirmSheet
- [ ] Integrate all services

### **Tests**
- [ ] Unit tests: all utility functions
- [ ] Unit tests: all service functions
- [ ] Integration tests: draft lifecycle
- [ ] Integration tests: bulk upload session
- [ ] Maestro flows: all 5 flows listed in Testing Requirements
- [ ] Manual testing per test cases file

### **Cross-Track Integration (Track 1)**
- [ ] Verify `age_group`, `gender`, `brand`, `color` columns exist (from Track 1 migration)
- [ ] Confirm `search_listings` RPC accepts these new fields
- [ ] Confirm ItemCreateScreen saves these fields on publish
- [ ] Confirm BulkListingCreateScreen saves these fields on publish

---

*Document version: 1.0 | Last updated: April 19, 2026 | Next review: after Track 2 implementation*
