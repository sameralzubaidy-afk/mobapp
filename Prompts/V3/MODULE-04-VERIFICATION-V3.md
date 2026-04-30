# MODULE-04 VERIFICATION CHECKLIST (V3 — Bulk Listing + AI Auto-Fill)

**Module:** Item Listing
**Version:** 3.0
**Last Updated:** April 21, 2026
**Traceability:** `POC1/ai-code-generator/modules/docx/BULK-LISTING-REQUIREMENTS.md` v1.0

---

## VERIFICATION CHECKLIST

### 1. SCHEMA (LISTING-V3-001)

- [ ] Migration `20260420000003_create_item_bulk_uploads.sql` applied on staging
  - [ ] Table `item_bulk_uploads` has columns per spec (`id, seller_id, status, total_photos, total_items, published_items, created_at, completed_at`)
  - [ ] CHECK `total_items <= 15`
  - [ ] CHECK `total_photos <= 30`
  - [ ] CHECK `status IN ('pending','processing','completed','partial','failed')`
  - [ ] RLS enabled; policies "Seller can manage own bulk uploads" + "Admin can view all bulk uploads"
- [ ] Migration `20260420000004_create_item_drafts.sql` applied
  - [ ] Table `item_drafts` with `draft_data JSONB`, `photo_urls TEXT[]`, `ai_suggestions JSONB`, `step`, `expires_at` (default `now() + 7 days`)
  - [ ] Trigger `update_item_drafts_updated_at` BEFORE UPDATE
  - [ ] Trigger `enforce_max_drafts` AFTER INSERT keeps 5 most-recent rows per seller
  - [ ] RLS enabled; policy "Seller can manage own drafts"
  - [ ] Indexes `idx_item_drafts_seller_id`, `idx_item_drafts_expires_at`
- [ ] Migration `20260420000005_add_bulk_listing_columns_to_items.sql` applied
  - [ ] `items.bulk_upload_id UUID` FK → `item_bulk_uploads(id) ON DELETE SET NULL`
  - [ ] `items.requested_category_name TEXT` with CHECK `LENGTH(...) <= 100`
  - [ ] Partial indexes `idx_items_bulk_upload_id`, `idx_items_requested_category`
  - [ ] COMMENT ON COLUMN set for both
- [ ] All migrations idempotent (re-run without error)
- [ ] MODULE-05 V3 columns (`age_group`, `gender`, `brand`, `color`) still present — not re-added here

### 2. EDGE FUNCTIONS (LISTING-V3-002)

- [ ] `supabase/functions/analyze-item-image/index.ts` updated
  - [ ] Accepts `{ photoUrl, sellerId, requestFields? }`
  - [ ] Returns `AIAnalysisResult` with per-field `{ value, confidence }`
  - [ ] Fields with confidence < 0.40 omitted from response
  - [ ] Google Vision 429 → exponential backoff (1s / 2s / 4s)
  - [ ] Categories cached 5 min; fuzzy match via Levenshtein
- [ ] `supabase/functions/batch-analyze-items/index.ts` created
  - [ ] Accepts `{ items: [{ groupId, primaryPhotoUrl, allPhotoUrls }], sellerId }`
  - [ ] Max concurrency 5 (semaphore / `Promise.allSettled`)
  - [ ] 10s per-item timeout via `AbortController`
  - [ ] Returns `{ results, totalProcessed, totalFailed }` — failed items carry `error`, do not throw
- [ ] `supabase/functions/_shared/aiTypes.ts` exports `AIAnalysisResult`, `AIFieldResult<T>`
- [ ] Both functions deployed (`supabase functions deploy analyze-item-image`, `... batch-analyze-items`)
- [ ] Smoke test: invoke each function against a known test photo URL; assert 200

### 3. SERVICES (LISTING-V3-003)

- [ ] `src/services/photoService.ts`
  - [ ] `validatePhoto` rejects non-JPEG/PNG/WebP, > 10MB, < 400×400
  - [ ] `compressPhoto` uses `expo-image-manipulator`; output ≤ 1MB; resizes if width > 1200
  - [ ] `uploadPhotoBatch` writes to `listings/{seller_id}/{timestamp}/`; returns `{ urls, errors }` on partial failure
  - [ ] `groupPhotosAuto` enforces 10/group, 30 total, 15 groups caps
  - [ ] `regroupPhotos` is immutable; intra-group order preserved
- [ ] `src/services/aiService.ts`
  - [ ] `analyzePhotosBatch` invokes `batch-analyze-items`
  - [ ] `parseAIResult` strips confidence < 0.40 fields defensively
  - [ ] `getAIConfidenceLevel(0.70) === 'high'`, `(0.40) === 'medium'`, `(0.39) === 'low'`
- [ ] `src/services/draftService.ts`
  - [ ] `createItemDraft` inserts; max-5 eviction relied on via trigger
  - [ ] `updateItemDraft` uses JSONB `||` merge (not fetch-then-overwrite)
  - [ ] `publishDraft` validates required fields, calls existing V2 `createItem`, then deletes draft
  - [ ] `publishBulkDrafts` returns `{ published, failed, errors }`; updates bulk_upload status to `completed | partial | failed`
- [ ] `src/services/pricingService.ts`
  - [ ] `getSuggestedPrice` returns `[]` when < 5 comparable sales
  - [ ] Tier midpoints: great_deal 0.45, fair_price 0.60, asking_price 0.75, almost_new 0.90 of avg
- [ ] `src/services/conditionService.ts`
  - [ ] `getConditionGuide` cached 24h in AsyncStorage
  - [ ] `getPopularColors` re-exports 12 names from `COLOR_PALETTE`
- [ ] `src/services/categoryService.ts` — V2 exports preserved; V3 adds:
  - [ ] `getCategoriesWithCounts(includeInactive=false)`
  - [ ] `flagForCategoryReview(itemId, name)` — idempotent (upsert review_flag)
  - [ ] `getRecentCategories(sellerId)` — AsyncStorage `@kids_marketplace:recent_categories_{sellerId}`, max 3, LRU
- [ ] No duplicate `PREDEFINED_BRANDS` / Levenshtein / `COLOR_PALETTE` anywhere (reuse MODULE-05 V3)
- [ ] Unit tests pass (`npm test -- --testPathPattern=services`)

### 4. TYPES & HOOKS (LISTING-V3-004)

- [ ] `src/types/listing.ts` exports: `AIAnalysisResult`, `AIFieldResult<T>`, `PhotoAsset`, `PhotoGroup`, `ItemDraft`, `DraftData`, `BulkPublishResult`, `PriceTier`, `ConditionGuide`, `Condition`
- [ ] `useItemDraft`
  - [ ] 30s auto-save interval
  - [ ] Flushes on `AppState → background`
  - [ ] Flushes on navigation `blur`
  - [ ] `saveNow()` forces immediate flush
  - [ ] Exposes `saveError` (never throws)
- [ ] `useAIAnalysis`
  - [ ] `status`: `idle | analyzing | ready | error`
  - [ ] Aborts pending fetch when `photoUrls` change
  - [ ] Single retry on network error (1.5s delay)
- [ ] `usePhotoGroups`
  - [ ] Enforces caps (10/group, 30 total, 15 groups)
  - [ ] Returns errors array instead of throwing
- [ ] Unit tests pass (`npm test -- --testPathPattern=hooks`)

### 5. ITEMCREATESCREEN (LISTING-V3-005)

- [ ] Route name `ItemCreate` unchanged
- [ ] Navigation params shape unchanged
- [ ] First visible state = `ADDING_PHOTOS` with `PhotoUploadManager`
- [ ] AI analysis is non-blocking (no full-screen spinner)
- [ ] `AIAnalysisCard` slides in when status = `ready`
- [ ] "Apply All" skips already-filled fields
- [ ] Per-field "Use" shows toast "Applied AI suggestion"
- [ ] Condition change triggers `getSuggestedPrice` → updates `PriceSuggestionCard`
- [ ] Publish disabled until V2-required fields set + ≥1 photo
- [ ] On publish: V3 fields (`age_group`, `gender`, `brand`, `color`, `requested_category_name`) saved
- [ ] "Other" category flow: calls `flagForCategoryReview` after create
- [ ] `useItemDraft` auto-save runs every 30s; `saveNow` called on back navigation
- [ ] `deleteDraft` awaited before navigate on publish success
- [ ] App type-checks (`npm run type-check`) and builds (`expo start` completes)

### 6. BULKLISTINGCREATESCREEN (LISTING-V3-006)

- [ ] Screen registered as route `BulkListingCreate`
- [ ] Sell-tab FAB shows bottom sheet with "List One Item" and "Bulk Upload"
- [ ] `BulkPhotoUploader` uses `expo-image-picker` with `selectionLimit=30`
- [ ] On photos added: inserts `item_bulk_uploads` row with `status='pending'`
- [ ] Auto-grouping defaults to 2 photos per group
- [ ] Drag-between-groups works; caps enforced
- [ ] "Confirm Grouping" sets `status='processing'` and fires `analyzePhotosBatch`
- [ ] `BulkItemCard` updates live as each AI result arrives
- [ ] Per-card "Exclude from publish" toggle works; bottom bar count reflects included only
- [ ] `BulkPublishConfirmSheet` greys out items with missing required fields
- [ ] `publishBulkDrafts` invoked on publish; partial result surfaces failed items
- [ ] Whole session stored as ONE draft row with `draft_data.items[]`
- [ ] `saveNow` called on back navigation with unsaved state
- [ ] Drag handles announce position via a11y

### 7. RESUME BANNER + NAV WIRING (LISTING-V3-007)

- [ ] `ResumeDraftBanner` shows on HomeScreen mount when `getActiveDrafts` > 0
- [ ] Tap banner navigates to `ItemCreate` (or `BulkListingCreate` if `bulk_upload_id` set) with `draftId` param
- [ ] Banner dismiss is session-only (reappears next app open)
- [ ] "Your Listings" has Drafts tab with relative time-ago + Resume button
- [ ] Swipe-to-discard calls `deleteDraft`
- [ ] Navigator registers `BulkListingCreate`
- [ ] FAB bottom-sheet wired correctly

### 8. PRESENTATIONAL COMPONENTS (LISTING-V3-008)

- [ ] All 10 components exist at specified paths:
  - [ ] `PhotoUploadManager.tsx`
  - [ ] `AIAnalysisCard.tsx`
  - [ ] `CategorySelectModal.tsx`
  - [ ] `ConditionSelector.tsx`
  - [ ] `ConditionGuideOverlay.tsx`
  - [ ] `ColorPicker.tsx`
  - [ ] `AgeGroupSelector.tsx`
  - [ ] `GenderSelector.tsx`
  - [ ] `PriceSuggestionCard.tsx`
  - [ ] `PublishButton.tsx`
- [ ] Strict TS, no `any`
- [ ] No component imports services directly (clean layering)
- [ ] `PhotoUploadManager` marks `photos[0]` as Cover and enforces 10 cap
- [ ] `AIAnalysisCard` respects `isFieldFilled` guard in Apply All
- [ ] `ColorPicker` uses `COLOR_PALETTE` from MODULE-05 V3
- [ ] `GenderSelector` "Any" maps to `undefined`
- [ ] `AgeGroupSelector` values: `'0-2','3-5','6-8','9-12','13+'`
- [ ] `PriceSuggestionCard` renders manual-only when `tiers.length === 0`
- [ ] Every touchable has `accessibilityLabel` + `accessibilityHint`

### 9. REUSE CHECK (LISTING-V3-009)

- [ ] `grep -r "PREDEFINED_BRANDS" src/` returns only the definition in `src/services/brandAutocomplete.ts` (plus imports)
- [ ] `grep -r "levenshtein" src/` returns only `src/utils/fuzzyMatch.ts` (plus imports)
- [ ] `grep -r "COLOR_PALETTE" src/` shows consumers importing from `@/types/discovery`, not redefining
- [ ] `BrandAutocompleteInput` is imported from MODULE-05 V3 location, not re-created

### 10. TESTS (LISTING-V3-010)

- [ ] 5 service test files pass, coverage ≥ 85% for listed service files:
  - [ ] `photoService.test.ts`
  - [ ] `aiService.test.ts`
  - [ ] `draftService.test.ts`
  - [ ] `pricingService.test.ts`
  - [ ] `categoryService.test.ts`
- [ ] 3 hook test files pass:
  - [ ] `useItemDraft.test.tsx`
  - [ ] `useAIAnalysis.test.tsx`
  - [ ] `usePhotoGroups.test.tsx`
- [ ] PgTAP `supabase/tests/item_drafts.sql` passes (`supabase test db`)
  - [ ] Max-5 trigger: inserting 6 drafts leaves COUNT=5
  - [ ] `updated_at` trigger fires on UPDATE
- [ ] 4 Maestro flows documented in PR:
  - [ ] `item-create-happy-path.yaml`
  - [ ] `bulk-listing-publish-all.yaml`
  - [ ] `draft-resume.yaml`
  - [ ] `category-other.yaml`
- [ ] Perf spot-check logged: 10-photo `createItem` < 8s on mid-tier Android

### 11. CROSS-TRACK INTEGRATION

- [ ] Published items carry all 4 MODULE-05 V3 fields (`age_group`, `gender`, `brand`, `color`) when set
- [ ] `search_listings` RPC (MODULE-05 V3) returns items published by V3 flow without errors
- [ ] MODULE-12 admin review queue surfaces items with `requested_category_name` set (smoke test)
- [ ] MODULE-09 "First Listing" / "Power Seller" badges still fire on bulk publish (each `createItem` call triggers them)

### 12. SP EARNINGS PREVIEW (LISTING-V3-011)

- [ ] `SPEarningsPreview` component renders in `ItemCreateScreen` after price input
- [ ] SP estimate updates within 300ms of price change (debounced)
- [ ] Placeholder shown when category not selected: "Select category to see estimate"
- [ ] Free user sees grayed estimate + "🔒 Upgrade to earn SP" CTA with upgrade button
- [ ] Subscriber sees normal estimate with ✅ checkmark (not grayed)
- [ ] "Other" category shows 1.10x default + disclaimer "Base rate - may change after admin approval"
- [ ] Tapping (i) icon opens `SPInfoTooltip` with "What are Swap Points?" explanation
- [ ] Tooltip includes example calculation and disclaimer "Estimates based on list price"
- [ ] "Learn More" button in tooltip navigates to SP education screen
- [ ] `BulkItemCard` shows per-item SP estimate in payment preference section
- [ ] `BulkSPSummaryCard` renders above item list in `BulkListingCreateScreen`
- [ ] Bulk summary shows aggregate total SP across all included items
- [ ] Bulk summary shows per-category breakdown (itemCount, totalSP, multiplier)
- [ ] Breakdown sorted by highest SP first
- [ ] Category multipliers cached in AsyncStorage (`@kids_marketplace:category_sp_multipliers`)
- [ ] Cache includes timestamp and auto-refreshes if > 24h old on mount
- [ ] Network failure on initial fetch uses stale cache with warning toast (no crash)
- [ ] Missing cache + network failure defaults to 1.10x for all categories with error banner
- [ ] `calculateEarnedSP` returns correct values: (50, 1.20) → 60, (33.33, 1.10) → 37
- [ ] `calculateEarnedSP` returns 0 for invalid inputs (price ≤ 0 or multiplier out of range)
- [ ] `groupBulkItemsByCategory` correctly aggregates mixed categories
- [ ] Unit tests pass for `spCalculations.ts` (minimum 5 test cases)
- [ ] Unit tests pass for `useCategorySPCache` (cache hit/miss/stale/network fail scenarios)
- [ ] Component tests pass for `SPEarningsPreview` (4 states: loading, no category, free user, subscriber)
- [ ] Component tests pass for `BulkSPSummaryCard` (empty, single category, multi-category)
- [ ] Maestro flow: Create item → select category → enter price → verify SP estimate visible and correct
- [ ] Accessibility: (i) icon has touch target ≥ 44×44pt with label "What are Swap Points?"
- [ ] Accessibility: VoiceOver reads SP values correctly ("35 Swap Points")
- [ ] Accessibility: Grayed-out state for free users announces "locked, upgrade required"
- [ ] Accessibility: Tooltip modal traps focus, Esc closes, focus returns to trigger
- [ ] Performance: SP calculation completes in < 10ms (client-side)
- [ ] Performance: No API calls during typing/category changes (cache hit only)
- [ ] Performance: Bulk summary recalculates in < 50ms for 15 items
- [ ] MODULE-14 "Your listing is live" notification still fires per item

### 12. MIGRATION ORDER (regression guard)

- [ ] Applying migrations from a clean DB in lexicographic order succeeds:
  1. `20260420000001_add_item_filter_columns.sql` (MODULE-05 V3)
  2. `20260420000002_update_search_listings_rpc.sql` (MODULE-05 V3)
  3. `20260420000003_create_item_bulk_uploads.sql`
  4. `20260420000004_create_item_drafts.sql`
  5. `20260420000005_add_bulk_listing_columns_to_items.sql`
- [ ] No FK / column-order errors
- [ ] `supabase db reset` → `supabase db push` passes

---

## SIGN-OFF

- [ ] Engineering lead: ___________________ (date: __________)
- [ ] QA lead: ___________________ (date: __________)
- [ ] Product: ___________________ (date: __________)

*Document version: 1.0 | Generated from BULK-LISTING-REQUIREMENTS.md v1.0*
