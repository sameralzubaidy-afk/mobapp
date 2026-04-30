# MODULE 04: ITEM LISTING (V3 — Bulk Listing, AI Auto-Fill, Photo-First UX)

**Version:** 3.0 (Enhanced Single Item + Bulk Listing with AI)
**Status:** Ready for Implementation
**Last Updated:** April 29, 2026
**Dependencies:** MODULE-04 (Item Listing V2), MODULE-05 V3 (new filter columns), MODULE-12 (Admin — review queue)
**Target Release:** Week 4-6 (MVP Track 2)
**Traceability Source:** `POC1/ai-code-generator/modules/docx/BULK-LISTING-REQUIREMENTS.md` v1.0

---

## TASKS BREAKDOWN

| # | Task ID | Title | Duration | Priority |
|---|---------|-------|----------|----------|
| 1 | LISTING-V3-001 | Schema Migrations — Bulk Uploads, Drafts, Item Columns | 2h | Critical |
| 2 | LISTING-V3-002 | Edge Functions — `analyze-item-image` extend + `batch-analyze-items` new | 4h | Critical |
| 3 | LISTING-V3-003 | Services Layer — Photo, AI, Draft, Pricing, Condition, Category | 4h | High |
| 4 | LISTING-V3-004 | Types & Hooks (`useItemDraft`, `useAIAnalysis`, `usePhotoGroups`) | 2h | High |
| 5 | LISTING-V3-005 | ItemCreateScreen — rebuild as photo-first state machine | 6h | High |
| 6 | LISTING-V3-006 | BulkListingCreateScreen — new screen + 6 subcomponents | 6h | High |
| 7 | LISTING-V3-007 | Draft Resume Banner + Drafts tab + Navigation wiring | 2h | Medium |
| 8 | LISTING-V3-008 | Supporting Presentational Components (10 files) | 6h | Medium |
| 9 | LISTING-V3-009 | Reused / Shared Components (import — do not duplicate) | 0.5h | Medium |
| 10 | LISTING-V3-010 | Tests (Unit + Hook + PgTAP + Maestro) | 5h | High |
| 11 | LISTING-V3-011 | SP Earnings Preview — Single & Bulk Listing Estimates | 4h | High |

**Total estimated effort:** ~41.5h. Tasks are listed in strict execution order; downstream tasks depend on earlier ones.

---

## V3 OVERVIEW

This module **extends MODULE-04 V2** with the bulk listing + AI-assisted creation experience defined in `BULK-LISTING-REQUIREMENTS.md`. V2 delivered the basic item create/edit/publish flow with 5 photos max and a text-first form. V3 rebuilds the creation experience around a **photo-first** flow, adds **AI auto-fill** via Google Vision, introduces a **bulk listing** path (up to 30 photos → 15 items), and wires in the 4 new filter fields (`age_group`, `gender`, `brand`, `color`) added by MODULE-05 V3.

V3 is a **Track 2 feature** that directly consumes the schema introduced by MODULE-05 V3 Track 1. V3 also introduces two new tables (`item_bulk_uploads`, `item_drafts`) and two new columns (`items.bulk_upload_id`, `items.requested_category_name`).

V3 scope:

- **Photo-first flow** for single item creation (replaces V2 text-first form).
- **AI auto-fill** (Google Vision) for title, category, condition, brand, color, age_group, gender.
- **Background, non-blocking AI**: user can type while AI analyzes.
- **AI suggestion card** with "Apply All" + per-field "Use".
- **Bulk listing**: upload up to 30 photos → auto-group into up to 15 items → per-item AI analysis → publish all.
- **Draft auto-save** every 30s + on blur; 7-day TTL; max 5 drafts per seller.
- **Price suggestions**: 4 tiers (Great Deal / Fair / Asking / Almost New) + manual override.
- **Category modal** with search, recent-3, and "Other" free-text suggestion (flags admin review).
- **Condition photo guide** (real marketplace examples).
- **Drag-and-drop** photo reorder (within item) and regroup (between items in bulk).
- **Brand autocomplete** reused from MODULE-05 V3 (`brandAutocomplete.ts`).
- **New fields on all items**: `age_group`, `gender`, `brand`, `color[]` (values must match MODULE-05 V3 enums/palette).
- **Photo cap raised**: 5 → **10 per item**.

V3 **does not** change MODULE-04 V2 server-side listing lifecycle (publish/unpublish/sold) — only the creation surface. Existing `getItem`, `updateItem`, `deleteItem` continue to work unchanged.

---

## CHANGELOG FROM V2 → V3

### V2 Limitations (carried over from MODULE-04 V2)

- Text-first form forced sellers to fill title/category/condition before adding photos.
- Max **5 photos per item** (raised to 10 in V3).
- No AI assistance — every field manual.
- **No bulk creation** — 10 items = 10 separate flows.
- No draft persistence — accidental exit = lost work.
- No price guidance.
- Missing structured fields: `age_group`, `gender`, `brand`, `color` (required by MODULE-05 V3).
- No category search modal; flat category picker only.
- No "Other" category fallback with admin review.

### V3 Enhancements

1. **Schema additions (non-breaking):**
   - `items.bulk_upload_id UUID` (FK → `item_bulk_uploads`, `ON DELETE SET NULL`).
   - `items.requested_category_name TEXT` (CHECK length ≤ 100).
   - New table `item_bulk_uploads` (session tracking, max 30 photos / 15 items).
   - New table `item_drafts` (JSONB draft data, 7-day expiry, trigger-enforced max 5 per seller).
2. **Edge functions:**
   - `analyze-item-image` **extended** to return the 4 new fields + confidence per field.
   - `batch-analyze-items` **new** — parallel (concurrency=5) invocation wrapper.
3. **New/modified services:** `PhotoService`, `AIService`, `DraftService`, `PricingService`, `CategoryService` (enhanced), `BrandService` (reused from MODULE-05 V3), `ConditionService`.
4. **New screens:** `BulkListingCreateScreen`; `ItemCreateScreen` **rebuilt** as photo-first state machine.
5. **New components:** `PhotoUploadManager`, `AIAnalysisCard`, `CategorySelectModal`, `ConditionSelector` + guide overlay, `BrandAutocompleteInput` (shared with MODULE-05 V3), `ColorPicker`, `AgeGroupSelector`, `GenderSelector`, `PriceSuggestionCard`, `BulkPhotoUploader`, `PhotoGroupingView`, `ItemCardStack`, `BulkItemCard`, `BulkPublishBar`, `BulkPublishConfirmSheet`, `ResumeDraftBanner`.
6. **Photo cap raised** from 5 → 10 per item; bulk session cap = 30 total, 15 items.
7. **AI confidence tiers** (`>=0.70` high / `0.40–0.69` medium / `<0.40` low) drive UI.

---

## CRITICAL V3 RULES FOR ITEM LISTING MODULE

### Rule 1: Field Parity with MODULE-05 V3
- `age_group`, `gender`, `brand`, `color[]` values MUST match the enums/palette defined in MODULE-05 V3 (`SEARCH-FILTER-REQUIREMENTS.md` Appendix).
  - `age_group ∈ {'0-2','3-5','6-8','9-12','13+'}`
  - `gender ∈ {'boy','girl','unisex'}` (UI "Any" option maps to `NULL`, NOT to a string).
  - `brand` — free text, max 100 chars, sourced via `getBrandSuggestions` from `src/services/brandAutocomplete.ts` (MODULE-05 V3).
  - `color[]` — values drawn from `COLOR_PALETTE` in `src/types/discovery.ts` (12 entries).
- These 4 fields are **optional at publish time** — publish MUST NOT fail on missing values.

### Rule 2: AI Must Never Block
- Photo upload returns control to the form immediately.
- AI analysis runs in the background. While it runs: show a subtle pulsing icon only. NO full-screen spinner, NO modal.
- If user fills a field manually before AI returns, the AI suggestion for that field is shown in the card but **not applied automatically**; "Apply All" skips already-filled fields.

### Rule 3: AI Confidence Thresholds (enforced client-side)
- `>= 0.70` → high → shown in AI card, eligible for "Apply All".
- `0.40 – 0.69` → medium → shown with "Maybe?" label, **not** in "Apply All".
- `< 0.40` → low → treated as `null`; form field shown with dashed-border prompt.

### Rule 4: Draft Invariants
- Drafts are server-side (`item_drafts` table), not AsyncStorage.
- TTL = 7 days; max 5 per seller (trigger `enforce_max_drafts` evicts oldest on INSERT).
- Auto-save cadence: every **30 seconds** while the screen is focused + once on `blur`/nav-away.
- Bulk sessions are stored as **one draft per session** (all grouped items in `draft_data.items`).
- After successful publish, the draft row MUST be deleted (hard delete).

### Rule 5: Bulk Limits (enforced both client + DB)
- Max 30 photos per bulk session (`item_bulk_uploads.total_photos <= 30` CHECK).
- Max 15 items per bulk session (`item_bulk_uploads.total_items <= 15` CHECK).
- Max 10 photos per item (client-side only — no DB CHECK because `items` does not hold photos directly).
- Default auto-grouping: 2 photos per item, sequential.

### Rule 6: Category "Other" → Admin Review
- Selecting "Other" opens a required text input (≤ 100 chars) → stored in `items.requested_category_name`.
- On publish, MUST call `flagForCategoryReview(itemId, requestedName)` which creates a `review_flag` row so admins (MODULE-12) surface it.
- The item is still published (not held) — admin edits the category later.

### Rule 7: Photo Pipeline
- Client-side: `validatePhoto` (JPEG/PNG/WebP, ≤10MB raw, ≥400×400) → `compressPhoto` (≤1MB, resize if width > 1200) → upload to Supabase Storage path `listings/{seller_id}/{timestamp}/`.
- Partial uploads allowed — `uploadPhotoBatch` returns `{ urls: string[], errors: UploadError[] }`.
- Cover photo = `photo_urls[0]`. Reorder must update this index.

### Rule 8: Backward Compatibility
- All V2 fields remain required (title, description, price, category_id, condition).
- V2 `createItem` / `updateItem` / `deleteItem` signatures are **unchanged**. V3 services call them under the hood.
- Existing items (pre-V3) MUST continue to render in all V2 screens. The 4 new columns are nullable.

### Rule 9: Accessibility
- All touchable elements have `accessibilityLabel` + `accessibilityHint`.
- Drag handles ≥ 44×44pt.
- AI card announces "AI suggestions available" on mount.
- Photo count read as "N of 10 photos".
- Color picker announces "`<color>` button, selected/unselected".

---

## AGENT TEMPLATE

```typescript
/*
YOU ARE AN AI AGENT IMPLEMENTING MODULE-04 ITEM LISTING V3 (BULK + AI AUTO-FILL).

CONTEXT:
- Kids P2P Marketplace. React Native (Expo) app + Supabase backend.
- MODULE-04 V2 exists: items table, createItem/updateItem/deleteItem services,
  basic ItemCreateScreen (text-first, 5 photos max).
- MODULE-05 V3 has ALREADY been merged and has added:
    - items.age_group, items.gender, items.brand, items.color[] (see
      supabase/migrations/20260420000001_add_item_filter_columns.sql)
    - src/services/brandAutocomplete.ts (PREDEFINED_BRANDS, getBrandSuggestions)
    - src/types/discovery.ts (COLOR_PALETTE, PRICE_PRESETS, STORAGE_KEYS)
- V3 adds 2 new columns + 2 new tables, 2 edge functions, and rebuilds the
  create surface to be photo-first with AI auto-fill and bulk support.
- Source of truth: POC1/ai-code-generator/modules/docx/BULK-LISTING-REQUIREMENTS.md

YOUR INSTRUCTIONS:
1. Read the entire module before generating any code.
2. Produce a short plan (4-8 steps) and list any missing dependencies.
3. Implement tasks in the order LISTING-V3-001 … LISTING-V3-010.
4. For each task: generate files at the exact filepath given; run type-check
   and unit tests; do NOT commit.
5. Migration file numbering continues after MODULE-05 V3:
     20260420000003_create_item_bulk_uploads.sql
     20260420000004_create_item_drafts.sql
     20260420000005_add_bulk_listing_columns_to_items.sql
   (Order matters: items FK to item_bulk_uploads, so bulk_uploads first.)
6. If a file already exists from V2 (e.g. src/screens/ItemCreateScreen.tsx),
   REPLACE the screen body but KEEP route name + navigation params; any V2
   service exports that are still used must be preserved.
7. DO NOT create duplicate utilities that already exist in MODULE-05 V3:
   reuse brandAutocomplete.ts, COLOR_PALETTE, fuzzyMatch.ts, STORAGE_KEYS.
8. Stop and report to the user before running any `supabase db push`, edge
   function deploy, or any destructive command.

VERIFICATION STEPS (agent must print results after each task):
- TypeScript type-check: `npm run type-check`
- Linting: `npm run lint`
- Unit tests (only the new ones):
    `npm test -- --testPathPattern=listing|bulk|draft|photo|ai|pricing`
- Maestro flows (manual run on device): see LISTING-V3-010.

ERROR HANDLING:
- If a required column from MODULE-05 V3 is missing, STOP and report: the user
  must apply MODULE-05 V3 migrations first.
- If Google Vision returns 429 (rate limit), retry with exponential backoff
  (3 attempts, 1s/2s/4s). After that, fall back to empty AI result and show
  the empty-form state with a toast: "AI couldn't analyze this photo."
- If `item_drafts` INSERT fails because of the max-5 trigger, the trigger
  auto-evicts — treat as success but log a warning.

==================================================
NEXT TASK: LISTING-V3-001 (Schema — Bulk Uploads, Drafts, Item Columns)
==================================================
*/
```

---

## TASK LISTING-V3-001: Schema Migrations — Bulk Uploads, Drafts, Item Columns

**Duration:** 2 hours
**Priority:** Critical (foundational — blocks all other V3 tasks)
**Dependencies:** MODULE-04 V2 (items table), MODULE-05 V3 migrations (filter columns)

### Description

Create two new tables (`item_bulk_uploads`, `item_drafts`) and add two new columns to `items` (`bulk_upload_id`, `requested_category_name`). Create indexes, RLS policies, and the two triggers for `item_drafts` (`updated_at` auto-touch + max-5 enforcement).

### Scope

**In scope:**
- 3 new Supabase migrations (bulk_uploads table, drafts table, items column additions).
- All indexes, RLS policies, and 2 `item_drafts` triggers (`updated_at`, `enforce_max_drafts`).
- Idempotent DDL and commented verification queries.

**Out of scope:**
- Re-adding MODULE-05 V3 columns (`age_group`, `gender`, `brand`, `color`).
- Backfill of existing items into `item_bulk_uploads`.
- Application-level draft logic (handled in LISTING-V3-003).

### Files to Create

| File | Purpose |
|---|---|
| `supabase/migrations/20260420000003_create_item_bulk_uploads.sql` | `item_bulk_uploads` table + RLS |
| `supabase/migrations/20260420000004_create_item_drafts.sql` | `item_drafts` table + 2 triggers + RLS |
| `supabase/migrations/20260420000005_add_bulk_listing_columns_to_items.sql` | `items.bulk_upload_id`, `items.requested_category_name` + 2 indexes |

### Acceptance Criteria

- [ ] Three migration files exist at the exact paths above.
- [ ] `item_bulk_uploads` has columns: `id, seller_id, status, total_photos, total_items, published_items, created_at, completed_at` — with the CHECK constraints from § Database Schema Changes.
- [ ] `item_drafts` has columns: `id, seller_id, bulk_upload_id, draft_data JSONB, photo_urls TEXT[], ai_suggestions JSONB, step, created_at, updated_at, expires_at` (default `now() + 7 days`).
- [ ] Trigger `update_item_drafts_updated_at` fires `BEFORE UPDATE` and sets `NEW.updated_at = now()`.
- [ ] Trigger `enforce_max_drafts` fires `AFTER INSERT` and keeps only the 5 most-recently-updated rows per `seller_id`.
- [ ] RLS: seller owns bulk uploads / drafts; admin can SELECT bulk uploads.
- [ ] `items.bulk_upload_id` FK → `item_bulk_uploads(id) ON DELETE SET NULL`.
- [ ] `items.requested_category_name` TEXT with `CHECK (LENGTH(requested_category_name) <= 100)`.
- [ ] Indexes: `idx_items_bulk_upload_id` (partial, `bulk_upload_id IS NOT NULL`), `idx_items_requested_category` (partial, `requested_category_name IS NOT NULL`), `idx_item_drafts_seller_id`, `idx_item_drafts_expires_at`.
- [ ] All migrations are idempotent (`IF NOT EXISTS` on tables, columns, indexes; `CREATE OR REPLACE` on functions/triggers where safe).
- [ ] Verification queries (commented-out at end of each file) list columns/triggers/policies created.

### AI Prompt for Cursor

````text
TASK: Generate 3 Supabase migrations for MODULE-04 V3.

CONTEXT:
- MODULE-05 V3 migrations (20260420000001, 20260420000002) are ALREADY applied.
  They added age_group, gender, brand, color[] to items. Do NOT re-add those.
- You are adding: item_bulk_uploads table, item_drafts table, and 2 new
  columns on items (bulk_upload_id FK, requested_category_name TEXT).
- user_roles table exists; admin policy on bulk uploads uses it.

REQUIREMENTS (verbatim from BULK-LISTING-REQUIREMENTS.md § Database Schema Changes):

FILE 1: supabase/migrations/20260420000003_create_item_bulk_uploads.sql
- Create public.item_bulk_uploads as specified.
- CHECK total_items <= 15, total_photos <= 30.
- Enable RLS; policies: "Seller can manage own bulk uploads" (FOR ALL, seller_id=auth.uid()),
  "Admin can view all bulk uploads" (FOR SELECT, via user_roles).

FILE 2: supabase/migrations/20260420000004_create_item_drafts.sql
- Create public.item_drafts with expires_at default now() + INTERVAL '7 days'.
- Function update_item_drafts_updated_at() + BEFORE UPDATE trigger.
- Function enforce_max_drafts() + AFTER INSERT trigger: DELETE rows for same seller
  NOT IN the 4 most-recent (so after INSERT, only 5 remain).
- Enable RLS; policy "Seller can manage own drafts" FOR ALL USING seller_id=auth.uid().
- Indexes: idx_item_drafts_seller_id (seller_id, updated_at DESC),
  idx_item_drafts_expires_at (expires_at).

FILE 3: supabase/migrations/20260420000005_add_bulk_listing_columns_to_items.sql
- ALTER TABLE items ADD COLUMN IF NOT EXISTS bulk_upload_id UUID
  REFERENCES item_bulk_uploads(id) ON DELETE SET NULL.
- ALTER TABLE items ADD COLUMN IF NOT EXISTS requested_category_name TEXT
  CHECK (LENGTH(requested_category_name) <= 100).
- idx_items_bulk_upload_id (partial WHERE bulk_upload_id IS NOT NULL).
- idx_items_requested_category (partial WHERE requested_category_name IS NOT NULL).
- COMMENT ON COLUMN for both.

OUTPUT 3 FILES, each starting with `--- FILE: <path> ---` then the full SQL.

VERIFICATION QUERIES (commented-out at bottom of each file):
- File 1: SELECT tablename, policyname FROM pg_policies WHERE tablename='item_bulk_uploads';
- File 2: SELECT tgname FROM pg_trigger WHERE tgrelid='item_drafts'::regclass;
- File 3: SELECT column_name FROM information_schema.columns
          WHERE table_name='items' AND column_name IN ('bulk_upload_id','requested_category_name');
````

---

## TASK LISTING-V3-002: Edge Functions — `analyze-item-image` (extend) + `batch-analyze-items` (new)

**Duration:** 4 hours
**Priority:** Critical
**Dependencies:** LISTING-V3-001

### Description

Extend the existing `analyze-item-image` edge function to return the 4 new fields with per-field confidence scores. Add a new `batch-analyze-items` function that parallelizes calls for the bulk flow (max concurrency 5, 10s per-item timeout, partial-failure tolerant).

### Scope

**In scope:**
- MODIFY `analyze-item-image` to emit the 7-field `AIAnalysisResult` with per-field confidence.
- NEW `batch-analyze-items` edge function (semaphore=5, per-item `AbortController`).
- Shared `_shared/aiTypes.ts` for edge + client type parity.
- Google Vision 429 retry policy (1s / 2s / 4s).

**Out of scope:**
- LLM-based description generation (post-MVP).
- Client-side fallback heuristics (handled by `aiService` in LISTING-V3-003).
- Pricing inference (LISTING-V3-003 `pricingService`).

### Files

| Path | Action |
|---|---|
| `supabase/functions/analyze-item-image/index.ts` | MODIFY |
| `supabase/functions/batch-analyze-items/index.ts` | NEW |
| `supabase/functions/_shared/aiTypes.ts` | NEW (shared `AIAnalysisResult` type) |

### `AIAnalysisResult` (exact shape — must match client `src/types/listing.ts`)

```ts
export interface AIFieldResult<T> { value: T; confidence: number; }

export interface AIAnalysisResult {
  title?:      AIFieldResult<string>;
  category?:   AIFieldResult<{ label: string; categoryId: string | null }>;
  condition?:  AIFieldResult<'new' | 'like_new' | 'good' | 'fair' | 'worn'>;
  brand?:      AIFieldResult<string>;
  color?:      AIFieldResult<string[]>;
  age_group?:  AIFieldResult<'0-2' | '3-5' | '6-8' | '9-12' | '13+'>;
  gender?:     AIFieldResult<'boy' | 'girl' | 'unisex'>;
  rawLabels?:  string[];
  error?:      string;
}
```

### Acceptance Criteria

- [ ] `analyze-item-image` request accepts `{ photoUrl, sellerId, requestFields? }`; `requestFields` defaults to all 7 fields.
- [ ] Response conforms to `AIAnalysisResult`. Fields with confidence `< 0.40` are omitted entirely (not set to `null`).
- [ ] Category matching: Vision label → `getCategories()` fuzzy match (use `findClosestMatch` from `@/utils/fuzzyMatch` on the server — or replicate the Levenshtein function inline since edge functions can't import RN code). If no match, `categoryId = null`, `label` kept.
- [ ] Vision 429 → exponential backoff (3 attempts: 1s / 2s / 4s).
- [ ] `batch-analyze-items` request: `{ items: Array<{ groupId, primaryPhotoUrl, allPhotoUrls }>, sellerId }`.
- [ ] Response: `{ results: Array<{ groupId, analysis, error? }>, totalProcessed, totalFailed }`.
- [ ] Uses `Promise.allSettled` with a semaphore of 5 concurrent in-flight calls.
- [ ] 10s per-item timeout (`AbortController`); timed-out items return `{ groupId, error: 'timeout' }` and do NOT block siblings.
- [ ] Both functions deployed successfully (`supabase functions deploy`).

### AI Prompt for Cursor

````text
TASK: Edge functions for AI analysis (single + batch).

DELIVERABLES:
- MODIFY supabase/functions/analyze-item-image/index.ts
- CREATE supabase/functions/batch-analyze-items/index.ts
- CREATE supabase/functions/_shared/aiTypes.ts (export AIAnalysisResult, AIFieldResult)

RULES:
- Use Deno std APIs available in Supabase edge runtime.
- Read GOOGLE_VISION_API_KEY from Deno.env.
- Category fuzzy-match: fetch categories via service-role supabase client once
  per cold start and cache for 5 minutes; run Levenshtein matching inline.
- Confidence scoring:
    title: from OCR + label rank (>=0.70 if top label contains product word).
    category: 1.0 if exact name match; linear 0.4–0.9 by Levenshtein distance.
    condition: label keyword map ("new","nwt","like new","good","used","worn").
    brand: direct match against PREDEFINED_BRANDS logos; 0.9 for logo match.
    color: dominant colors from Vision imageProperties (>= 0.05 pixel fraction).
    age_group / gender: keyword heuristics ("baby","boy","girl","kids").
- Omit fields below 0.40 confidence entirely from the response.
- batch-analyze-items: semaphore pattern, concurrency 5, 10s timeout per call,
  uses Promise.allSettled. Never throw — failures are returned per-item.

OUTPUT 3 FILES, each preceded by `--- FILE: <path> ---`.
````

---

## TASK LISTING-V3-003: Services Layer — Photo, AI, Draft, Pricing, Condition

**Duration:** 4 hours
**Priority:** High
**Dependencies:** LISTING-V3-001, LISTING-V3-002

### Description

Implement the V3 services layer: photo pipeline (validate / compress / upload / auto-group / regroup), AI batch invocation wrapper, server-side draft lifecycle (create / update / publish / bulk publish), price-suggestion tiers, condition guide, and MODULE-05 V3-compatible additions to `categoryService`.

### Scope

**In scope:**
- 5 new service files + 1 modified `categoryService` (preserve V2 exports).
- Reuse of MODULE-05 V3 utilities (`brandAutocomplete`, `COLOR_PALETTE`, `fuzzyMatch`) — no duplication.
- JSONB-merge update pattern for drafts (no fetch-then-overwrite).
- Idempotent `flagForCategoryReview`.

**Out of scope:**
- UI components and screens (LISTING-V3-005 / 006 / 008).
- Hooks (LISTING-V3-004).
- New migrations — all DDL lives in LISTING-V3-001.

### Files to Create / Modify

| Path | Action | Exports |
|---|---|---|
| `p2p-kids-marketplace/src/services/photoService.ts` | NEW | `uploadPhotoBatch`, `linkPhotosToItems`, `validatePhoto`, `compressPhoto`, `groupPhotosAuto`, `regroupPhotos`, `getPhotoThumbnail`, `getPhotoCount` |
| `p2p-kids-marketplace/src/services/aiService.ts` | NEW | `analyzePhotosBatch`, `parseAIResult`, `getAIConfidenceLevel` |
| `p2p-kids-marketplace/src/services/draftService.ts` | NEW | `createItemDraft`, `getItemDraft`, `updateItemDraft`, `deleteDraft`, `getActiveDrafts`, `publishDraft`, `publishBulkDrafts` |
| `p2p-kids-marketplace/src/services/pricingService.ts` | NEW | `getSuggestedPrice`, `getPriceTierLabel` |
| `p2p-kids-marketplace/src/services/conditionService.ts` | NEW | `getConditionGuide`, `getPopularColors` |
| `p2p-kids-marketplace/src/services/categoryService.ts` | MODIFY | ADD `getCategoriesWithCounts`, `flagForCategoryReview`, `getRecentCategories`, `saveRecentCategory` (preserve V2 exports) |
| `p2p-kids-marketplace/src/services/brandAutocomplete.ts` | REUSE | no changes — re-export from MODULE-05 V3 |

### Acceptance Criteria (per function)

- [ ] `uploadPhotoBatch(photos, onProgress)` — uploads to `listings/{seller_id}/{timestamp}/`, returns `{ urls, errors }`, calls `onProgress(n)` per successful upload. Tolerates partial failure.
- [ ] `validatePhoto(asset)` — returns `{ valid: false, error }` for non-JPEG/PNG/WebP, > 10MB raw, or dimensions < 400×400.
- [ ] `compressPhoto(uri, quality=0.8)` — output ≤ 1MB; if width > 1200px, resize preserving aspect ratio.
- [ ] `groupPhotosAuto(photos)` — sequential, 2 per group by default; respects 10/group, 30 total, 15 groups caps; returns `PhotoGroup[]` with stable `groupId`s.
- [ ] `regroupPhotos(groups, sourceGroupId, photoId, targetGroupId)` — immutable update; maintains intra-group order; no-op if target already contains photo.
- [ ] `analyzePhotosBatch(photoUrls)` — invokes `batch-analyze-items` edge function; returns `AIAnalysisResult[]` in request order; each entry may carry `error`.
- [ ] `parseAIResult(raw)` — strips fields < 0.40 confidence (defensive; edge function also does this).
- [ ] `getAIConfidenceLevel(score)` — returns `'high' | 'medium' | 'low'` per Rule 3.
- [ ] `createItemDraft(sellerId, initial)` — inserts into `item_drafts`; relies on trigger for max-5 eviction; returns new row.
- [ ] `updateItemDraft(draftId, updates)` — JSONB merge on `draft_data` using `draft_data = draft_data || $1::jsonb`.
- [ ] `getActiveDrafts(sellerId)` — SELECT WHERE `expires_at > now()` ORDER BY `updated_at DESC`.
- [ ] `publishDraft(draftId)` — validates required fields (title, description, price, category_id, condition, ≥1 photo); calls existing V2 `createItem`; on success DELETEs draft.
- [ ] `publishBulkDrafts(bulkUploadId, itemIds)` — iterates items; returns `{ published, failed, errors }`; updates `item_bulk_uploads.published_items` and sets `status` to `completed | partial | failed` accordingly.
- [ ] `getSuggestedPrice(categoryId, condition)` — queries avg sold price over last 90d (`items WHERE status='sold'`); returns `[]` if fewer than 5 comparable rows; otherwise returns 4-tier array using multipliers from § UX Decision 7.
- [ ] `flagForCategoryReview(itemId, name)` — UPDATE items SET requested_category_name = $1; INSERT review_flag with `type='category_suggestion'`.
- [ ] `getRecentCategories(sellerId)` — AsyncStorage key `@kids_marketplace:recent_categories_{sellerId}`, max 3 entries, LRU.
- [ ] `getPopularColors()` — returns the 12-color palette by re-exporting `COLOR_PALETTE` names from MODULE-05 V3.
- [ ] Unit tests in `src/__tests__/services/` for each file (see LISTING-V3-010).

### AI Prompt for Cursor

````text
TASK: Implement MODULE-04 V3 services layer.

CONTEXT:
- supabase client at src/lib/supabase.ts (typed).
- expo-image-manipulator installed for compression/resize.
- @react-native-async-storage/async-storage installed.
- Reuse from MODULE-05 V3:
    src/services/brandAutocomplete.ts  (PREDEFINED_BRANDS, getBrandSuggestions)
    src/types/discovery.ts              (COLOR_PALETTE, STORAGE_KEYS)
    src/utils/fuzzyMatch.ts             (findClosestMatch)
- Types for V3 live in src/types/listing.ts (generated in LISTING-V3-004).

Produce 6 service files (photoService, aiService, draftService, pricingService,
conditionService, categoryService MODIFY). Each starts with
`--- FILE: <path> ---`.

HARD RULES:
- photoService.compressPhoto MUST use expo-image-manipulator.
- draftService.updateItemDraft MUST use JSONB concatenation (|| operator) via
  rpc or a SQL template — do NOT fetch-then-overwrite (race condition).
- publishBulkDrafts MUST sum successes/failures accurately and update the
  bulk_upload row in a single UPDATE at the end.
- getSuggestedPrice tier multipliers (must match spec exactly):
    great_deal: 0.40-0.50 of avg, midpoint 0.45
    fair_price: 0.55-0.65 of avg, midpoint 0.60
    asking_price: 0.70-0.80 of avg, midpoint 0.75
    almost_new: 0.85-0.95 of avg, midpoint 0.90
- flagForCategoryReview MUST be idempotent (upsert review_flag on
  (item_id, type='category_suggestion')).

Do not generate components or screens. Services only.
````

---

## TASK LISTING-V3-004: Types & Hooks

**Duration:** 2 hours
**Priority:** High
**Dependencies:** LISTING-V3-003

### Description

Define the V3 TypeScript types in `src/types/listing.ts` and the three supporting React hooks (`useItemDraft`, `useAIAnalysis`, `usePhotoGroups`) that wrap the V3 services behind stable, tested interfaces for screens and components.

### Scope

**In scope:**
- 1 types file + 3 hook files, all strict TS (no `any`).
- Unit tests for all 3 hooks via `@testing-library/react-native` + `jest.useFakeTimers`.
- Autosave, AppState/blur flush, `AbortController` cancellation, cap enforcement.

**Out of scope:**
- Screens and components (later tasks).
- Service implementations (LISTING-V3-003).
- Navigation wiring.

### Files

| Path | Purpose |
|---|---|
| `p2p-kids-marketplace/src/types/listing.ts` | `AIAnalysisResult`, `AIFieldResult<T>`, `PhotoAsset`, `PhotoGroup`, `ItemDraft`, `DraftData`, `BulkPublishResult`, `PriceTier`, `ConditionGuide`, `Condition` enum |
| `p2p-kids-marketplace/src/hooks/useItemDraft.ts` | NEW — autosave hook (30s interval + blur flush) |
| `p2p-kids-marketplace/src/hooks/useAIAnalysis.ts` | NEW — triggers `analyzePhotosBatch` and exposes `{ status, result, error, retry }` |
| `p2p-kids-marketplace/src/hooks/usePhotoGroups.ts` | NEW — state + actions for bulk grouping (add, remove, regroup, setCover) |

### Acceptance Criteria

- [ ] `Condition = 'new' | 'like_new' | 'good' | 'fair' | 'worn'` — reused across `items.condition`.
- [ ] `PhotoGroup = { groupId: string; photos: PhotoAsset[] }`.
- [ ] `DraftData` mirrors what is stored in `item_drafts.draft_data` JSONB (title, description, price, category_id, requested_category_name, condition, age_group, gender, brand, color[], photo_urls[], items?: DraftData[] for bulk).
- [ ] `useItemDraft(draftId?)` — returns `{ draft, save, saveNow, discard, isSaving }`. Internally debounces at 30s; `saveNow` flushes immediately; auto-flushes on `AppState` change to `background` AND on navigation `blur`.
- [ ] `useAIAnalysis(photoUrls)` — returns `{ status: 'idle'|'analyzing'|'ready'|'error', result, error, retry }`. Does NOT auto-run until `photoUrls.length > 0`.
- [ ] `usePhotoGroups()` — encapsulates add/remove/reorder/regroup/setCover; enforces caps (10/group, 30 total, 15 groups); returns `{ groups, addPhotos, removePhoto, regroup, setCover, errors }`.
- [ ] Unit tests for all 3 hooks with `@testing-library/react-native`.

### AI Prompt for Cursor

````text
TASK: Generate types + 3 hooks for MODULE-04 V3.

Produce 4 files. Strict TypeScript. No `any`.

FILE 1: p2p-kids-marketplace/src/types/listing.ts
FILE 2: p2p-kids-marketplace/src/hooks/useItemDraft.ts
FILE 3: p2p-kids-marketplace/src/hooks/useAIAnalysis.ts
FILE 4: p2p-kids-marketplace/src/hooks/usePhotoGroups.ts

useItemDraft specifics:
- Accepts optional draftId; if omitted, creates a new draft on first save.
- Maintains internal draftRef so the timer writes the latest state.
- setInterval(30_000); also subscribes to `AppState.change → background` and
  the screen's `navigation.addListener('blur', ...)` to saveNow.
- Never throws to the caller; surfaces save errors via returned `saveError`.

useAIAnalysis specifics:
- Effect keyed on photoUrls.join('|'); cancels pending fetch on change via
  AbortController.
- Retries once on network error with 1.5s delay.

usePhotoGroups specifics:
- enforces caps and returns errors array (e.g. {code:'MAX_PHOTOS', message:...})
  instead of throwing.
````

---

## TASK LISTING-V3-005: ItemCreateScreen (rebuild as photo-first)

**Duration:** 6 hours
**Priority:** High
**Dependencies:** LISTING-V3-003, LISTING-V3-004

### Description

Replace the V2 body of `ItemCreateScreen` with a photo-first state machine. Keep the route name and navigation params identical. Integrate `PhotoUploadManager`, `AIAnalysisCard`, `CategorySelectModal`, `ConditionSelector`, `BrandAutocompleteInput`, `ColorPicker`, `AgeGroupSelector`, `GenderSelector`, `PriceSuggestionCard`.

### Scope

**In scope:**
- MODIFY the body of `ItemCreateScreen.tsx` (keep export default + route name + params).
- Wire state machine (`IDLE → ADDING_PHOTOS → AI_ANALYZING → REVIEWING_SUGGESTIONS → FILLING_DETAILS → SETTING_PRICE → PUBLISHING → SUCCESS|ERROR`).
- Integrate `useItemDraft`, `useAIAnalysis`, all V3 presentational components.
- Call `flagForCategoryReview` on "Other" publish.

**Out of scope:**
- Bulk flow (LISTING-V3-006).
- Component implementations (LISTING-V3-008).
- Service logic (LISTING-V3-003).
- Navigator/route registration (LISTING-V3-007).

### File

`p2p-kids-marketplace/src/screens/ItemCreateScreen.tsx` (MODIFY — replace body, keep export + route)

### State Machine

```
IDLE → ADDING_PHOTOS → AI_ANALYZING (background) → REVIEWING_SUGGESTIONS
     → FILLING_DETAILS → SETTING_PRICE → PUBLISHING → SUCCESS|ERROR
```

### Acceptance Criteria

- [ ] First screen state is `ADDING_PHOTOS` with `PhotoUploadManager` front-and-center.
- [ ] After ≥1 photo uploaded → `useAIAnalysis` fires; form becomes scrollable and editable immediately (non-blocking).
- [ ] When AI status becomes `ready`, `AIAnalysisCard` slides in with entrance animation.
- [ ] "Apply All" button on card fills only empty fields; already-filled fields remain.
- [ ] Per-field "Use" button overrides the current field value and shows a brief toast ("Applied AI suggestion").
- [ ] Condition select triggers `getSuggestedPrice` load; `PriceSuggestionCard` updates.
- [ ] Publish button disabled until all V2-required fields are set + ≥1 photo.
- [ ] On publish: creates item via V2 `createItem` using fields from form **+ new V3 fields** (`age_group`, `gender`, `brand`, `color`, `requested_category_name` when "Other"); on success navigates to `ItemDetail`.
- [ ] If user selected "Other" category, calls `flagForCategoryReview(itemId, requestedName)` after createItem.
- [ ] Draft: `useItemDraft` auto-saves every 30s; on `navigation.goBack()` with unsaved changes, calls `saveNow()` before pop. Back button does NOT prompt a confirm dialog (per spec — auto-save is silent).
- [ ] After successful publish, `deleteDraft(draftId)` is awaited before navigate (fire-and-forget acceptable if within 500ms budget).
- [ ] Route/navigator **unchanged**.

### AI Prompt for Cursor

````text
TASK: Rebuild ItemCreateScreen as a photo-first state machine.

FILE: p2p-kids-marketplace/src/screens/ItemCreateScreen.tsx (MODIFY)

KEEP:
- export default ItemCreateScreen
- route name `ItemCreate` (do not change navigator)
- navigation params shape (`{ draftId?: string }`)

REPLACE body with a state machine using useReducer. States as listed in the
module. Integrate hooks: useItemDraft, useAIAnalysis. Mount the following
components (generated in LISTING-V3-008):
  PhotoUploadManager, AIAnalysisCard, CategorySelectModal, ConditionSelector,
  BrandAutocompleteInput, ColorPicker, AgeGroupSelector, GenderSelector,
  PriceSuggestionCard, PublishButton.

HARD RULES:
- No full-screen spinner during AI analysis. Use a small pulsing icon in the
  header area only.
- AIAnalysisCard.onApplyAll MUST skip already-filled fields.
- On publish success: await deleteDraft, then navigate('ItemDetail', { id }).
- If category === 'other': requestedCategoryName becomes required (>=1 char);
  call flagForCategoryReview after item is created.
- Accessibility: every touchable has accessibilityLabel + accessibilityHint.
````

---

## TASK LISTING-V3-006: BulkListingCreateScreen (new)

**Duration:** 6 hours
**Priority:** High
**Dependencies:** LISTING-V3-003, LISTING-V3-004

### Description

New screen for bulk upload → auto-group → batch AI → per-item review → publish-all. Separate from `ItemCreateScreen` per UX Decision 11.

### Scope

**In scope:**
- 1 new screen + 6 new bulk subcomponents under `src/components/bulk/`.
- Bulk state machine (`IDLE → ADDING_PHOTOS → GROUPING → AI_ANALYZING → REVIEWING_ITEMS → PUBLISHING → SUCCESS|PARTIAL|ERROR`).
- Multi-select image picker (≤ 30), drag-between-groups, batch publish orchestration.
- One-draft-per-session persistence via `draft_data.items[]`.

**Out of scope:**
- Video clips, cross-platform listing (post-MVP).
- Single-item flow (LISTING-V3-005).
- Presentational form controls (LISTING-V3-008 — reused here).
- Tests (LISTING-V3-010).

### Files

| Path | Purpose |
|---|---|
| `p2p-kids-marketplace/src/screens/BulkListingCreateScreen.tsx` | Top-level screen |
| `p2p-kids-marketplace/src/components/bulk/BulkPhotoUploader.tsx` | 30-photo multi-picker |
| `p2p-kids-marketplace/src/components/bulk/PhotoGroupingView.tsx` | Drag photos between groups |
| `p2p-kids-marketplace/src/components/bulk/ItemCardStack.tsx` | Horizontal scroll of items |
| `p2p-kids-marketplace/src/components/bulk/BulkItemCard.tsx` | Collapsible item card with mini-form |
| `p2p-kids-marketplace/src/components/bulk/BulkPublishBar.tsx` | Fixed bottom "Publish N items" |
| `p2p-kids-marketplace/src/components/bulk/BulkPublishConfirmSheet.tsx` | Pre-publish summary sheet |

### State Machine

```
IDLE → ADDING_PHOTOS → GROUPING → AI_ANALYZING → REVIEWING_ITEMS → PUBLISHING → SUCCESS|PARTIAL|ERROR
```

### Acceptance Criteria

- [ ] Entry point: "Sell" tab FAB → bottom sheet with two options ("List One Item" / "Bulk Upload") — the latter navigates here.
- [ ] `BulkPhotoUploader` uses `expo-image-picker` with `allowsMultipleSelection=true`, `selectionLimit=30`.
- [ ] On photos added: `startBulkSession` INSERTs a `item_bulk_uploads` row with `status='pending'`, then `groupPhotosAuto` groups them.
- [ ] `PhotoGroupingView` supports drag-between-groups via `react-native-draggable-flatlist`; enforces caps.
- [ ] "Confirm Grouping" → updates `item_bulk_uploads.status='processing'`, `total_photos`, `total_items`, then fires `analyzePhotosBatch` for each group's primary photo.
- [ ] As each AI result arrives, the corresponding `BulkItemCard` updates live.
- [ ] Tapping a card expands/opens full edit view (reuses the same form components from ItemCreateScreen in a compact layout).
- [ ] Each card has an "Exclude from publish" toggle.
- [ ] "Publish N Items" bar count reflects only included items.
- [ ] `BulkPublishConfirmSheet` shows count + any warnings (items with missing required fields greyed out).
- [ ] On publish: calls `publishBulkDrafts`; on partial success, shows which items failed with reasons.
- [ ] Draft behavior: the whole session is stored as **one** draft row in `item_drafts` with `draft_data.items` being an array.
- [ ] On back navigation with unsaved state: `saveNow()` is called.
- [ ] Accessibility: drag handles announce position ("Photo 2 of 4 in Item 1").

### AI Prompt for Cursor

````text
TASK: Build BulkListingCreateScreen and its 6 subcomponents.

DELIVER 7 files (1 screen + 6 components) at the paths listed in LISTING-V3-006.

CROSS-CUTTING RULES:
- Use react-native-draggable-flatlist for the grouping view.
- Use expo-image (cachePolicy="memory-disk") for all photo rendering.
- Each component no larger than ~200 lines; split if needed.
- State lives in BulkListingCreateScreen and flows down as props; avoid context.
- BulkItemCard reuses the per-field form controls from ItemCreateScreen by
  importing them from their component files (do NOT inline duplicate logic).
- Publish flow calls publishBulkDrafts; on PARTIAL result, show the summary
  sheet again with failed items flagged — do NOT navigate away automatically.

Add navigator wiring in the existing stack:
  route name: 'BulkListingCreate' → BulkListingCreateScreen
  Add the FAB bottom-sheet options in the Sell tab (find the file and modify).

No tests in this task — tests go in LISTING-V3-010.
````

---

## TASK LISTING-V3-007: Draft Resume Banner + Navigation Wiring

**Duration:** 2 hours
**Priority:** Medium
**Dependencies:** LISTING-V3-003, LISTING-V3-005, LISTING-V3-006

### Description

Wire the draft-resume UX and the bulk/single entry points: a resume banner on home, a Drafts tab on Your Listings, and a Sell-tab FAB bottom sheet that routes users into either the single or bulk creation flow.

### Scope

**In scope:**
- 1 new component (`ResumeDraftBanner`), 2 screen modifications (Your Listings, navigator).
- FAB bottom sheet with two routes.
- Drafts tab with swipe-to-discard.

**Out of scope:**
- Draft service logic (already in LISTING-V3-003).
- New screens beyond modifications listed.
- Push-notification reminders for unfinished drafts (post-MVP).

### Files

| Path | Purpose |
|---|---|
| `p2p-kids-marketplace/src/components/molecules/ResumeDraftBanner.tsx` | "You have N unfinished listing(s). Continue?" |
| `p2p-kids-marketplace/src/screens/profile/YourListingsScreen.tsx` | MODIFY — add "Drafts" tab |
| Navigator file (e.g. `src/navigation/RootNavigator.tsx`) | MODIFY — register `BulkListingCreate`, Sell-tab FAB bottom sheet |

### Acceptance Criteria

- [ ] On app open (mount of `HomeScreen`): if `getActiveDrafts(userId).length > 0`, show `ResumeDraftBanner`.
- [ ] Tapping banner opens `ItemCreateScreen` with `{ draftId }` param (or `BulkListingCreate` if the draft has `bulk_upload_id`).
- [ ] Banner dismiss is soft (session-level state); it will reappear next app open.
- [ ] "Your Listings" screen has a **Drafts** tab showing `getActiveDrafts` results with relative time-ago and "Resume" button.
- [ ] Drafts tab supports swipe-to-discard which calls `deleteDraft`.
- [ ] Sell-tab FAB shows a bottom sheet: "List One Item" → `ItemCreate`, "Bulk Upload" → `BulkListingCreate`.

### AI Prompt for Cursor

````text
TASK: Wire draft resume banner, drafts tab, and the Sell-tab FAB.

FILES:
- src/components/molecules/ResumeDraftBanner.tsx (NEW)
- src/screens/profile/YourListingsScreen.tsx (MODIFY — add Drafts tab)
- the Root/Main navigator (find existing path; MODIFY to register
  'BulkListingCreate' and the FAB action sheet)

RULES:
- Banner must call getActiveDrafts on mount and show only while at least 1
  non-expired draft exists.
- Drafts tab uses FlatList + pull-to-refresh; each row: thumbnail (first
  photo_url), title (or "Untitled draft"), relative time, Resume button.
- Swipe-to-delete uses the existing swipeable pattern in the codebase (look
  at MessageListScreen if unsure).
- FAB bottom sheet uses react-native Modal with animationType="slide".
````

---

## TASK LISTING-V3-008: Supporting Components

**Duration:** 6 hours
**Priority:** Medium
**Dependencies:** LISTING-V3-004

### Description

Generate the 10 presentational components used by `ItemCreateScreen` and `BulkListingCreateScreen`. These components are purely visual — they accept typed props and emit events. No service calls, no navigation, no direct state persistence.

### Scope

**In scope:**
- 10 component files under `src/components/listing/` (Photo, AI card, Category modal, Condition selector + guide, Color picker, Age/Gender selectors, Price card, Publish button).
- Full a11y labels + hints.
- Strict TS, typed props, ≤ ~150 lines each.

**Out of scope:**
- Business logic (lives in services and hooks).
- Screen composition (LISTING-V3-005 / 006).
- Tests (LISTING-V3-010).

### Files

| Path | Role |
|---|---|
| `src/components/listing/PhotoUploadManager.tsx` | Step-1 photo grid, cover badge, drag reorder, 10-photo cap |
| `src/components/listing/AIAnalysisCard.tsx` | Sliding card with Apply All + per-field Use |
| `src/components/listing/CategorySelectModal.tsx` | Full-screen modal; search, recent-3, all, Other |
| `src/components/listing/ConditionSelector.tsx` | 5 radio rows; each with 📸 opening `ConditionGuideOverlay` |
| `src/components/listing/ConditionGuideOverlay.tsx` | Real-photo examples per condition |
| `src/components/listing/ColorPicker.tsx` | 12-swatch multi-select |
| `src/components/listing/AgeGroupSelector.tsx` | 5 pills: 0-2…13+ |
| `src/components/listing/GenderSelector.tsx` | 4 pills: boy / girl / unisex / Any |
| `src/components/listing/PriceSuggestionCard.tsx` | 4 tier cards + manual input |
| `src/components/listing/PublishButton.tsx` | Large primary button with loading + disabled states |

### Acceptance Criteria

- [ ] All components are function components with typed props.
- [ ] No component imports from screens (clean layering).
- [ ] `PhotoUploadManager` uses `react-native-draggable-flatlist`; marks `photos[0]` with "Cover" badge; enforces 10-photo cap.
- [ ] `AIAnalysisCard` props: `{ analysis: AIAnalysisResult; isFieldFilled: (field) => boolean; onApplyAll(); onApplyField(field, value); onDismiss() }`.
- [ ] `CategorySelectModal` props: `{ visible, categories, recent, onSelect(category), onSelectOther(name), onClose }`.
- [ ] `ConditionSelector` props: `{ value, onChange, onOpenGuide(code) }`.
- [ ] `ColorPicker` multi-select; selected state rendered via border + check mark; `accessibilityState={{ selected }}`.
- [ ] `PriceSuggestionCard` props: `{ tiers, selectedTier, manualValue, onSelectTier, onChangeManual, onShowFaq }`; renders manual-only when `tiers.length === 0`.
- [ ] `GenderSelector` "Any" maps `value` to `undefined` (not a string).
- [ ] `AgeGroupSelector` values match MODULE-05 V3 enum exactly.
- [ ] Full a11y on all interactive elements.
- [ ] Each component ≤ ~150 lines.

### AI Prompt for Cursor

````text
TASK: Generate 10 presentational components for MODULE-04 V3.

Produce 10 files under src/components/listing/**. Each file begins with
`--- FILE: <path> ---`. Use StyleSheet.create; theme-agnostic semantic color
names (COLORS.primary, COLORS.border, etc.) so theming can plug in later.

CROSS-CUTTING RULES:
- Strict TS. No `any`. Props typed.
- Only allowed deps: react, react-native, expo-image, expo-image-manipulator,
  react-native-draggable-flatlist, @react-native-async-storage/async-storage,
  react-native-safe-area-context.
- Accessibility labels + hints on every touchable.
- Follow ASCII mocks in BULK-LISTING-REQUIREMENTS.md § Component Specifications
  as the source of truth for layout.

Do not include business logic that belongs in services — components call
handlers passed via props; they don't import services directly.
````

---

## TASK LISTING-V3-009: Reused / Shared Components (import — do not duplicate)

**Duration:** 0.5 hours (wiring only)
**Priority:** Medium
**Dependencies:** MODULE-05 V3

### Description

The following modules already exist from MODULE-05 V3. V3 tasks MUST import them rather than duplicating.

### Scope

**In scope:**
- Audit imports across all LISTING-V3-* files to confirm reuse.
- Wire imports for `BrandAutocompleteInput`, `PREDEFINED_BRANDS`, `COLOR_PALETTE`, `fuzzyMatch` utilities.
- Grep-based sanity checks (no duplicate constants).

**Out of scope:**
- Re-implementing any of the above.
- Modifying MODULE-05 V3 files.

| Item | Source (MODULE-05 V3) |
|---|---|
| `BrandAutocompleteInput` | `src/components/molecules/BrandAutocompleteInput.tsx` |
| `getBrandSuggestions`, `PREDEFINED_BRANDS` | `src/services/brandAutocomplete.ts` |
| `COLOR_PALETTE`, `STORAGE_KEYS` | `src/types/discovery.ts` |
| `findClosestMatch`, `levenshteinDistance` | `src/utils/fuzzyMatch.ts` |

### Acceptance Criteria

- [ ] Grep confirms no duplicate `PREDEFINED_BRANDS` constant anywhere in the repo.
- [ ] `ColorPicker` imports `COLOR_PALETTE` from `@/types/discovery`.
- [ ] Filter/brand input components import from `@/services/brandAutocomplete`.
- [ ] No re-implementation of Levenshtein distance in this module.

---

## TASK LISTING-V3-010: Tests (Unit + Integration + Maestro)

**Duration:** 5 hours
**Priority:** High
**Dependencies:** LISTING-V3-005, 006, 007, 008

### Description

Ship the full test package for MODULE-04 V3: Jest unit tests for services and hooks, PgTAP tests for the `item_drafts` triggers, and Maestro E2E flows for happy path + critical edge cases (bulk publish, draft resume, "Other" category).

### Scope

**In scope:**
- 8 Jest suites (5 service + 3 hook).
- 1 PgTAP SQL file covering max-5 and `updated_at` triggers.
- 4 Maestro YAML flows with tags.
- Fixture builders (`makeItem`, `makeDraft`, `makeAIResult`).
- Coverage target ≥ 85% for V3 services.

**Out of scope:**
- Visual-regression tests.
- Load testing.
- CI pipeline wiring (tracked separately).

### Test Files

| Path | Covers |
|---|---|
| `src/__tests__/services/photoService.test.ts` | `validatePhoto` edge cases, `groupPhotosAuto` caps, `regroupPhotos` immutability |
| `src/__tests__/services/aiService.test.ts` | `parseAIResult` confidence stripping, `getAIConfidenceLevel` boundaries |
| `src/__tests__/services/draftService.test.ts` | create/update/publish/delete; max-5 trigger behavior via mocked supabase |
| `src/__tests__/services/pricingService.test.ts` | Tier math with seeded avg, empty-data fallback |
| `src/__tests__/services/categoryService.test.ts` | `flagForCategoryReview` idempotency, recent category LRU |
| `src/__tests__/hooks/useItemDraft.test.tsx` | 30s debounce, blur-flush, saveNow |
| `src/__tests__/hooks/useAIAnalysis.test.tsx` | idle→analyzing→ready; abort on photoUrls change; retry path |
| `src/__tests__/hooks/usePhotoGroups.test.tsx` | caps enforcement, regroup, setCover |
| `supabase/tests/item_drafts.sql` | PgTAP: max-5 trigger; updated_at trigger |
| `e2e/item-create-happy-path.yaml` | Maestro: photo → AI → apply → publish |
| `e2e/bulk-listing-publish-all.yaml` | Maestro: 8 photos → 4 items → publish |
| `e2e/draft-resume.yaml` | Maestro: create → exit → resume banner → continue |
| `e2e/category-other.yaml` | Maestro: select Other → enter name → publish → flag exists |

### Acceptance Criteria

- [ ] All Jest tests pass (`npm test`).
- [ ] Coverage for `src/services/{photo,ai,draft,pricing,condition,category}Service.ts` ≥ 85%.
- [ ] PgTAP tests pass against local supabase (`supabase test db`).
- [ ] 4 Maestro flows run against a staging build (documented in PR, not CI-gated).
- [ ] Perf spot-check: single `createItem` including 10 compressed photos completes in < 8s on mid-tier Android (manual).

### AI Prompt for Cursor

````text
TASK: Generate test suites for MODULE-04 V3.

OUTPUT:
- 8 Jest test files (5 service + 3 hook).
- 1 PgTAP SQL test file at supabase/tests/item_drafts.sql.
- 4 Maestro YAML flows under p2p-kids-marketplace/e2e/.

For Jest:
- Use jest.mock for @supabase/supabase-js and AsyncStorage.
- For hook tests, use @testing-library/react-native + jest.useFakeTimers.
- Sample data: use the fixture builders from src/__tests__/fixtures (create if
  missing: `makeItem`, `makeDraft`, `makeAIResult`).

For PgTAP:
- Use plan(N) + pass/fail assertions.
- Seed a user via auth.users insert (or use the `tests.create_supabase_user`
  helper if already present).
- Test max-5: insert 6 drafts, assert COUNT(*)=5 for that seller.
- Test updated_at trigger: update row, assert updated_at changed.

For Maestro: flows must use tags so they can be invoked selectively
(`tags: ["listing","happy-path"]`, etc.).
````

---

## CROSS-TRACK INTEGRATION NOTES

- **MODULE-05 V3 (Discovery — Track 1):** PROVIDES the 4 new item columns and the brand/color/filter plumbing. V3 consumes them. Any schema mismatch between V3 enums/palette and MODULE-05 V3 is a bug in this module (MODULE-05 V3 is the source of truth).
- **MODULE-12 V3 (Admin Categories):** CONSUMES `items.requested_category_name` (surfaced in the review queue with a "Suggest as category" action). V3 only **writes** this field; the admin UI is out of scope here.
- **MODULE-14 (Notifications):** On successful publish, an in-app notification "Your listing is live" is fired by existing V2 code — no changes required in V3. Bulk publish fires ONE "N listings published" notification (add to MODULE-14 backlog — tracked separately).
- **MODULE-09 (Points / Gamification):** "First Listing" and "Power Seller" badges already hook into `createItem`. Bulk publish calls `createItem` per item, so badge triggers fire naturally — verify in LISTING-V3-010 integration test.

---

## OUT OF SCOPE (Post-MVP)

- AI-generated full descriptions (LLM cost).
- Video clips in listings (storage/bandwidth cost).
- Cross-platform listing (Facebook/eBay OAuth).
- Pricing history chart (needs ≥3 months sold data).
- Location-based pricing.
- AR try-on / background removal.
- Batch edit after publish.
- Per-listing analytics.
- AI auto-pricing (price tier is rule-based in V3, not ML).
- Saved templates / duplicate-from-existing flow.

---

## IMPLEMENTATION CHECKLIST (high-level)

- [ ] LISTING-V3-001 — schema migrations (bulk_uploads, drafts, item columns)
- [ ] LISTING-V3-002 — edge functions (`analyze-item-image` extend + `batch-analyze-items` new)
- [ ] LISTING-V3-003 — services (photo, ai, draft, pricing, condition, category)
- [ ] LISTING-V3-004 — types + hooks (`useItemDraft`, `useAIAnalysis`, `usePhotoGroups`)
- [ ] LISTING-V3-005 — `ItemCreateScreen` rebuilt as photo-first
- [ ] LISTING-V3-006 — `BulkListingCreateScreen` + 6 subcomponents
- [ ] LISTING-V3-007 — resume banner + Drafts tab + navigator wiring
- [ ] LISTING-V3-008 — 10 presentational components
- [ ] LISTING-V3-009 — reuse check (no duplicate brand/color/Levenshtein)
- [ ] LISTING-V3-010 — unit + hook + PgTAP + 4 Maestro flows
- [ ] Apply migrations on staging; deploy edge functions; smoke-test end-to-end
- [ ] Manual QA with screen reader (VoiceOver + TalkBack)
- [ ] Update `PROMPTS_USAGE_GUIDE.md` with a pointer to this module

---

*Document version: 1.0 | Generated from BULK-LISTING-REQUIREMENTS.md v1.0 | Next review: after Track 2 implementation*
