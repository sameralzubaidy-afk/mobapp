# TODO: Bulk Listing with AI Auto-Fill (MVP)

**Track:** 2 — Bulk Listing with AI Auto-Fill  
**Priority:** MVP  
**Target Weeks:** 4–6  
**Flow IDs:** FLOW-04 (Listings), FLOW-05 (Media Upload)  
**Owner:** @sameralzubaidy-afk  
**Dependencies:**
- Track 1 (Search Enhancement) — `age_group`, `gender`, `brand` columns must exist on `items` table first
- Google Vision API credentials configured in Supabase Edge Function secrets
- `createListing()` + `uploadListingImages()` services already exist

---

## 1. Problem Statement

Today, sellers must:
1. Open Create Listing screen
2. Select ONE photo at a time (max 5)
3. Manually type title, description, category, condition, price, age group, gender, brand
4. Publish one item

**The goal:** Seller selects up to 20 photos from their gallery in a single pick session. For each photo, Google Vision AI suggests the category, brand, condition, and a draft title. Seller reviews, adjusts prices, and publishes all items in one tap.

**Budget:** ~$30–50/month Google Vision API (approved).

---

## 2. What We Are Building

### 2.1 Architecture Overview

```
[Seller Photo Gallery]
        ↓ (multi-select up to 20 photos)
[BulkListingCreateScreen] ← new screen
        ↓ (upload each photo to Storage)
[Supabase Edge Function: analyze-item-image]
        ↓ (calls Google Vision API)
[AI suggestions: category, brand, condition, title]
        ↓
[Draft grid: seller reviews/edits each item]
        ↓
[Bulk publish: createListing() × N items]
        ↓
[Success screen with item count]
```

### 2.2 Google Vision API — What We Use
API: **Cloud Vision API** — `annotateImage` method

**Features used per photo:**
| Vision Feature | What We Extract | Maps To |
|---------------|-----------------|---------|
| `LABEL_DETECTION` (top 10 labels) | "jeans", "toy", "book", "bicycle" | category suggestion |
| `OBJECT_LOCALIZATION` | Primary object in frame | title suggestion |
| `LOGO_DETECTION` | Brand logos (Nike, LEGO, etc.) | brand field |
| `TEXT_DETECTION` (limited) | Text on packaging/labels | title refinement |

**What Google Vision does NOT give us (we derive):**
- `condition` — infer from seller choice (not from image), default "good"
- `price` — seller sets manually (mandatory field)
- `age_group` — seller sets manually (optional)
- `gender` — infer from labels where possible ("dress" → girl, "truck" → optional), else null

**Cost:** $1.50 per 1,000 images (4 features = ~$6/1,000 → ~1 cent per photo at 4 features).

### 2.3 Category Mapping Table (hardcoded lookup)
Google Vision returns generic labels. We map these to our app categories:

```typescript
// File: p2p-kids-marketplace/src/utils/visionCategoryMap.ts
export const VISION_LABEL_TO_CATEGORY: Record<string, string> = {
  // Clothing
  'clothing': 'clothing', 'dress': 'clothing', 'jeans': 'clothing',
  'shirt': 'clothing', 'jacket': 'clothing', 'shoe': 'shoes',
  // Toys
  'toy': 'toys', 'doll': 'toys', 'action figure': 'toys', 'board game': 'toys',
  'lego': 'toys', 'stuffed animal': 'toys', 'plush': 'toys',
  // Books
  'book': 'books', 'novel': 'books', 'textbook': 'books',
  // Sports
  'bicycle': 'sports', 'ball': 'sports', 'skateboard': 'sports',
  'helmet': 'sports', 'scooter': 'sports',
  // Baby & Toddler
  'baby': 'baby', 'diaper': 'baby', 'stroller': 'baby', 'crib': 'baby',
  // Electronics
  'tablet': 'electronics', 'headphones': 'electronics', 'game controller': 'electronics',
  // Default
  'default': null, // null = no suggestion, seller must pick
};
```

Note: map only for confirmed categories. If no label matches, category suggestion = null (seller picks manually).

### 2.4 New Edge Function: `analyze-item-image`

**Path:** `supabase/functions/analyze-item-image/index.ts`

**Pattern:** Follows Edge Function Convention (one function = one folder).

**Request:**
```typescript
POST /functions/v1/analyze-item-image
Authorization: Bearer <user-jwt>
Content-Type: application/json
{
  "storage_path": "item-images/user_id/temp/photo_abc.jpg"
}
```

**Response:**
```typescript
{
  "success": true,
  "suggestions": {
    "title": "LEGO Star Wars Set",           // from object localization + logo
    "category_name": "toys",                  // from label mapping
    "brand": "LEGO",                           // from logo detection
    "condition": null,                         // Vision can't tell — seller picks
    "gender_hint": "unisex",                  // derived from labels
    "confidence": 0.82,                        // overall confidence 0-1
    "raw_labels": ["toy", "plastic", "lego"]  // for debug / future use
  }
}
```

**Error responses:**
```typescript
{ "success": false, "error": { "code": "IMAGE_TOO_SMALL", "message": "Image must be at least 200x200px" } }
{ "success": false, "error": { "code": "VISION_API_ERROR", "message": "Vision API unavailable", "details": "..." } }
{ "success": false, "error": { "code": "UNAUTHORIZED", "message": "Valid auth token required" } }
```

**Implementation notes:**
- Validate JWT (user must be authenticated)
- Validate storage_path is owned by calling user (path starts with `item-images/<user_id>/`)
- Use `GOOGLE_VISION_API_KEY` from Supabase secrets (not hardcoded)
- Request only the 4 Vision features needed (minimize cost)
- Timeout: 10 seconds max
- Log: `console.log('[analyze-item-image]', { userId: user.id.substring(0,8), confidence, labels_count })`
- If Vision API fails → return `success: false` with structured error (do NOT crash)
- In DEV mode (env `EXPO_PUBLIC_ENV=development`): return mock suggestions without calling Vision API

**Mock data for DEV mode:**
```typescript
const MOCK_SUGGESTIONS = {
  title: "Kids Item",
  category_name: "toys",
  brand: null,
  condition: null,
  gender_hint: "unisex",
  confidence: 0.5,
  raw_labels: ["toy", "object"],
};
```

### 2.5 New Screen: `BulkListingCreateScreen`

**Path:** `p2p-kids-marketplace/src/screens/listing/BulkListingCreateScreen.tsx`

**Navigation:** Added to listing stack in `AppNavigator.tsx`. Entry point: "List Multiple Items" button on CreateListingScreen or from profile/seller tab.

**4-step flow:**

---

#### STEP 1: Photo Selection
- Full-screen photo gallery picker (using `expo-image-picker` — already installed)
- Allow multi-select: up to 20 photos
- Minimum: 2 photos (single items use regular CreateListingScreen)
- Show count badge: "12 / 20 selected"
- "Next →" button enabled when ≥ 2 photos selected
- `// TODO(UX): refine photo grid layout once final Figma design is available`

---

#### STEP 2: AI Analysis (Loading Phase)
- Upload each selected photo to Supabase Storage: `item-images/<user_id>/temp/<uuid>.jpg`
- Call `analyze-item-image` Edge Function for each photo
- Show progress: "Analyzing 3 of 12 photos..."
- Parallel: max 3 concurrent uploads/analyses (rate limit)
- If Vision API fails for a photo: proceed with null suggestions (mark photo with "Add details manually" badge)
- Do NOT block the whole batch if 1 photo fails
- `// TODO(UX): add animated AI scan effect once Figma designs available`

---

#### STEP 3: Review Draft Grid
Each photo becomes a draft item card in a scrollable grid (2 columns).

Each card shows:
- Photo thumbnail
- Title field (pre-filled from AI, editable inline)
- Price field (empty — REQUIRED, highlighted in red until filled)
- Category pill (pre-selected from AI, tappable to change)
- Condition pill (default "good", tappable)
- "Edit ✎" button → opens `BulkItemEditModal`
- ✕ button → removes item from batch

**Inline edit:** Title and price can be edited directly on the card.
**Full edit:** Tapping "Edit ✎" opens the item edit modal (Step 3b).

#### STEP 3b: `BulkItemEditModal`
Full-screen modal for one item:
- Photo (non-editable in this modal — determined in Step 1)
- Title (text input)
- Description (text area, optional, max 1000 chars)
- Category (pill selector from `getCategories()`)
- Condition (pill selector: New / Like New / Good / Fair / Poor)
- Price (numeric input, required)
- Age Group (pill selector, optional)
- Gender (pill selector: Boy / Girl / Unisex / optional)
- Brand (text input, optional)
- AI confidence badge: "AI confidence: 82%" (shown if confidence > 0)
- "Save" → closes modal, updates draft grid

**Validation at modal level:**
- Title: 3–100 chars
- Price: > $0 and ≤ $10,000
- Category: must be selected

---

#### STEP 4: Publish All
- "Publish X Items" button (disabled until all items have price + category + title)
- Shows count of ready items vs total: "12 of 14 items ready"
- Items missing required fields highlighted in red
- On tap: sequential `createListing()` + `uploadListingImages()` per item
  - On success per item: mark card with ✓ overlay
  - On failure per item: mark card with ✗, show retry button for that item
- After all done: navigate to success screen: "12 items listed! 🎉"
  - Show "View My Listings" button
  - Show "List More Items" button

---

### 2.6 Updated `createListing()` Service
File: `p2p-kids-marketplace/src/services/listing.ts`

Ensure `createListing()` accepts and passes the new fields:
```typescript
interface CreateListingParams {
  // existing:
  seller_id: string;
  title: string;
  description?: string;
  price: number;
  category_id: string;
  condition: ListingCondition;
  accepts_swap_points: boolean;
  // NEW (from Track 1 Search Enhancement):
  age_group?: '0-2' | '3-5' | '6-8' | '9-12' | '13+' | null;
  gender?: 'boy' | 'girl' | 'unisex' | null;
  brand?: string | null;
}
```

### 2.7 Navigation Update
File: `p2p-kids-marketplace/src/navigation/AppNavigator.tsx`

Add `BulkListingCreate` to the stack.

File: `p2p-kids-marketplace/src/navigation/routes.ts`

Add:
```typescript
export const ROUTES = {
  // ... existing routes
  BULK_LISTING_CREATE: 'BulkListingCreate',
};
```

File: `p2p-kids-marketplace/src/navigation/types.ts`

Add `BulkListingCreate: undefined` to the param list.

---

## 3. Files to Create / Modify

### New Files:
| File | Purpose |
|------|---------|
| `supabase/functions/analyze-item-image/index.ts` | Edge Function: call Google Vision API |
| `p2p-kids-marketplace/src/screens/listing/BulkListingCreateScreen.tsx` | 4-step bulk listing screen |
| `p2p-kids-marketplace/src/components/molecules/BulkItemEditModal.tsx` | Per-item edit modal |
| `p2p-kids-marketplace/src/utils/visionCategoryMap.ts` | Label → category mapping table |
| `p2p-kids-marketplace/src/services/visionAnalysis.ts` | Client wrapper for analyze-item-image Edge Function |
| `supabase/migrations/20260420000003_bulk_listing_temp_storage_rls.sql` | RLS for temp storage path |

### Modified Files:
| File | Change |
|------|--------|
| `p2p-kids-marketplace/src/services/listing.ts` | Add age_group, gender, brand params |
| `p2p-kids-marketplace/src/navigation/AppNavigator.tsx` | Add BulkListingCreate route |
| `p2p-kids-marketplace/src/navigation/routes.ts` | Add BULK_LISTING_CREATE constant |
| `p2p-kids-marketplace/src/navigation/types.ts` | Add BulkListingCreate param type |
| `p2p-kids-marketplace/src/screens/listing/CreateListingScreen.tsx` | Add "List Multiple Items" entry point button |

---

## 4. Storage: Temp Photo Path
During bulk listing flow, photos are temporarily uploaded to:
```
item-images/<user_id>/temp/<uuid>.jpg
```

After listing is published, the final path is moved to:
```
item-images/<user_id>/<item_id>/<uuid>.jpg
```

Temp files older than 24 hours are cleaned up via cron job (existing infra can handle this).

RLS rule for temp path:
- User can INSERT to `item-images/<user_id>/temp/`
- User can READ from `item-images/<user_id>/temp/`
- No other user can access temp paths

---

## 5. Acceptance Criteria

### Edge Function (`analyze-item-image`):
- [ ] Requires valid user JWT — returns 401 if missing
- [ ] Validates storage_path belongs to calling user — returns 403 if mismatch
- [ ] Calls Google Vision API with: LABEL_DETECTION, OBJECT_LOCALIZATION, LOGO_DETECTION, TEXT_DETECTION
- [ ] Returns structured `suggestions` object
- [ ] Returns structured error (not 500) when Vision API fails
- [ ] DEV mock mode returns mock suggestions without calling Vision
- [ ] Does not log any PII (no full user IDs, no image content)

### Bulk Listing Screen:
- [ ] Photo selection: up to 20 photos, minimum 2
- [ ] Analysis progress displayed: "Analyzing X of Y..."
- [ ] Max 3 concurrent API calls (no flooding)
- [ ] Cards with failed AI analysis show "Add details manually" badge instead of crashing
- [ ] Price field required — "Publish" button blocked until all items have price
- [ ] Category + title required — highlighted red if missing
- [ ] Individual item can be removed from batch
- [ ] Inline title/price edit works on grid
- [ ] Full edit modal opens and saves correctly
- [ ] Publish flow shows per-item success/fail indicators
- [ ] Success screen shows count of published items
- [ ] Failed items show retry button (retry only that item)

### Navigation:
- [ ] "List Multiple Items" accessible from CreateListingScreen
- [ ] Route added to routes.ts and types.ts
- [ ] Back navigation from bulk flow returns to correct screen
- [ ] TypeScript: no TS2339 or route type errors

### TypeScript:
- [ ] `yarn typecheck` passes with 0 errors
- [ ] `yarn lint` passes with 0 errors
- [ ] No duplicate exported identifiers in edited files

---

## 6. Test Coverage Required

### Unit Tests (Jest):
- [ ] `src/__tests__/utils/visionCategoryMap.test.ts` — test label → category mapping
- [ ] `src/__tests__/services/visionAnalysis.test.ts` — test structured error handling when Edge Function returns non-200
- [ ] `src/__tests__/services/listing.test.ts` — test createListing with new fields (age_group, gender, brand)

### Maestro E2E (new files):
- [ ] `p2p-kids-marketplace/e2e/bulk-listing-create.yaml`
  - Select 3 photos
  - AI analysis completes (or mock mode)
  - Fill in price for each
  - Tap Publish
  - Verify 3 items appear in My Listings
- [ ] `p2p-kids-marketplace/e2e/bulk-listing-edit.yaml`
  - Select 2 photos
  - Open edit modal for item 1
  - Change title, category, condition
  - Save
  - Verify changes persist on draft grid

### Manual Verification Steps:
1. Set `GOOGLE_VISION_API_KEY` in Supabase Edge Function secrets (staging)
2. Run: `supabase functions deploy analyze-item-image`
3. Test with Postman: POST with a real image path → verify suggestions returned
4. In app (staging): select 5 photos → observe AI suggestions populate each card
5. Verify Google Vision console: confirm API calls are registering with correct feature count
6. Check cost: should be < $0.05 for 5 photos (4 features × 5 photos = 20 feature calls × $0.0015)

---

## 7. Environment Variables Required

### Supabase Edge Function Secrets (staging + production):
```
GOOGLE_VISION_API_KEY=<get from Google Cloud Console → APIs → Vision API → Credentials>
```

### Expo App (optional, for DEV mock mode):
```
EXPO_PUBLIC_USE_VISION_MOCK=true   # set in .env.local for dev
```

---

## 8. Out of Scope for This TODO
- AI-generated description text (title + category only — description is optional)
- CPSC recall check per item (already exists separately, runs post-publish)
- Price suggestions from AI (seller always sets price manually)
- Bulk EDIT of already-published listings (this is create-only)
- Video items
- NLP listing enhancement ("make this description better") — POST-LAUNCH

---

## 9. Open Questions
> **TODO(PRODUCT): What happens if all 20 photos fail AI analysis? Show bulk form with all fields empty and require manual entry? Or prompt to retry?**
> Proposed default: show all cards with "Add details manually" badge, seller can still publish manually.

> **TODO(PRODUCT): Should bulk-listed items be published immediately or go to 'draft' status for seller review?**
> Proposed default: published immediately (same as single listing). Seller can unpublish later.

> **TODO(UX): Finalize draft grid layout (2-col vs 1-col) once Figma designs available (Week 2-3)**

---

## 10. Preflight Gate (Before Merging)
```bash
cd p2p-kids-marketplace
yarn typecheck    # must exit 0
yarn lint         # must exit 0

# Verify no duplicate routes
rg -n "BulkListingCreate" src/navigation/

# Verify no duplicate exported function
rg -n "export.*analyzeItemImage\|export.*BulkListingCreate" src/
```

---

## Definition of Done
- [ ] `analyze-item-image` Edge Function deployed on staging
- [ ] BulkListingCreateScreen navigable from CreateListingScreen
- [ ] At least 3 photos analyzed, suggestions shown, published successfully (manual test on staging)
- [ ] All acceptance criteria above checked
- [ ] Maestro bulk-listing-create.yaml passes on staging
- [ ] Typecheck + lint PASS
- [ ] FLOW-04 + FLOW-05 smoke tests passing
