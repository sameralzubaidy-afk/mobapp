# MODULE-12 VERIFICATION CHECKLIST (V3 — Dynamic Category Management + SP Configuration)

**Module:** Admin Portal — Dynamic Category Management
**Version:** 3.0
**Last Updated:** April 21, 2026
**Traceability:** `POC1/ai-code-generator/modules/docx/ADMIN-CATEGORY-MANAGEMENT.md` v1.0
**Secondary Sources:** `tmp/SYSTEM_REQUIREMENTS_V2.md`, `tmp/BUSINESS_REQUIREMENTS_DOCUMENT_V2.md`, `tmp/POC desgin.md`

---

## VERIFICATION CHECKLIST

### 1. SCHEMA (ADMIN-V3-001)

- [ ] Migration `20260420000006_add_category_management_columns.sql` applied on staging
  - [ ] `categories` has all 11 new columns (`is_active, item_count, display_order, description, icon, icon_url, bonus_badge_icon_url, sp_earning_multiplier, sp_spending_cap_percent, sp_config_notes, sp_rate_change_notify`)
  - [ ] CHECK `sp_earning_multiplier BETWEEN 1.05 AND 1.40`
  - [ ] CHECK `sp_spending_cap_percent BETWEEN 50 AND 80`
  - [ ] CHECK `LENGTH(description) <= 200`, `LENGTH(icon) <= 50`, `LENGTH(sp_config_notes) <= 500`
  - [ ] `display_order` backfilled via `ROW_NUMBER() OVER (ORDER BY id)`
  - [ ] Indexes present: `idx_categories_active` (partial `is_active=true`), `idx_categories_item_count` (partial), `idx_categories_bonus` (partial `sp_earning_multiplier > 1.10`)
  - [ ] `COMMENT ON COLUMN` set for all new columns
- [ ] Migration `20260420000007_create_category_suggestions.sql` applied
  - [ ] Table `category_suggestions` with `id, suggested_name, seller_id, item_id, status, approved_by, merged_to_category_id, admin_note, created_at, reviewed_at`
  - [ ] `UNIQUE (item_id)` constraint present
  - [ ] `status` CHECK `IN ('pending','approved','rejected','merged')`
  - [ ] FKs: `seller_id → auth.users ON DELETE CASCADE`, `item_id → items ON DELETE CASCADE`, `approved_by → auth.users ON DELETE SET NULL`, `merged_to_category_id → categories ON DELETE SET NULL`
  - [ ] RLS enabled; policies "Admin can manage all suggestions" (FOR ALL via `user_roles`) + "Seller can view own suggestions" (FOR SELECT)
  - [ ] Indexes `idx_category_suggestions_status` (partial pending) + `idx_category_suggestions_seller`
- [ ] Migration `20260420000008_category_item_count_trigger.sql` applied
  - [ ] Function `update_category_item_count()` present
  - [ ] Trigger `update_category_item_count_trigger` fires `AFTER INSERT OR UPDATE OF category_id, status OR DELETE` on `items`
  - [ ] Initial backfill executed (counts match `SELECT COUNT(*) FROM items WHERE category_id = c.id AND status='available'`)
- [ ] Migration `20260420000009_reorder_categories_rpc.sql` applied
  - [ ] Function `reorder_categories(JSONB)` present, `SECURITY DEFINER`
  - [ ] Raises `Unauthorized: Admin role required` for non-admin callers
- [ ] Migration `20260420000010_create_category_icons_storage_bucket.sql` applied
  - [ ] Bucket `category-icons` exists, `public = true`
  - [ ] Storage RLS policies: public SELECT; admin-only INSERT/UPDATE/DELETE (via `user_roles` EXISTS)
- [ ] (If implemented) `20260420000011_category_suggestion_approve_fn.sql` applied with transactional `approve_category_suggestion` + `merge_category_suggestion` RPCs
- [ ] All migrations idempotent (re-run produces no errors)
- [ ] V2 RLS / routes on `categories` still intact (no regressions)

### 2. TYPES & ERRORS (ADMIN-V3-002)

- [ ] `admin-portal/src/types/category.ts` exports `Category`, `CreateCategoryInput`, `UpdateCategoryInput`, `CategorySuggestion`, `SuggestionStatus`, `CategorySPAnalytics`, `BonusCategory`, `ValidationResult`
- [ ] `admin-portal/src/types/errors.ts` exports `DuplicateNameError`, `CategoryNotEmptyError`, `SPRateOutOfRangeError`, `IconUploadError`, `UnauthorizedError` — all with stable `code` strings
- [ ] `p2p-kids-marketplace/src/types/category.ts` mirrors `Category` + `BonusCategory` (no admin-only fields)
- [ ] Strict TypeScript — no `any` in any of the 3 type files
- [ ] Mobile types do NOT import from `admin-portal/`

### 3. SERVICES (ADMIN-V3-003)

#### `admin-portal/src/services/categoryService.ts`
- [ ] `createCategory` validates name via regex `^[A-Za-z0-9 ]{3,50}$`, case-insensitive unique; sets `display_order = MAX+1`
- [ ] `updateCategory` refuses writes to `item_count`; re-checks uniqueness on name change
- [ ] `deleteCategory` throws `CategoryNotEmptyError` if `item_count > 0`; otherwise hard delete
- [ ] `toggleCategoryActive` refuses to deactivate seeded `"Other"` category
- [ ] `reorderCategories` issues ONE `reorder_categories` RPC call (no N+1)
- [ ] `uploadCategoryIcon` validates type (PNG/SVG), size ≤ 500 KB, dimensions ≥ 100×100; deletes prior object at same key before writing; persists public URL to `icon_url` or `bonus_badge_icon_url`
- [ ] `validateCategoryName` returns `{valid, error?}` (never throws)
- [ ] `checkCategoryUniqueness` uses `LOWER()` comparison + `excludeId` param

#### `admin-portal/src/services/categorySuggestionService.ts`
- [ ] `getCategorySuggestions(status?)` defaults to `'pending'`; orders by `created_at DESC`; joins seller + item
- [ ] `approveCategorySuggestion` transactional: creates category + reassigns item + updates suggestion row + sets `approved_by`, `reviewed_at`
- [ ] `rejectCategorySuggestion(id, note?)` sets `status='rejected'`, `reviewed_at`, optional `admin_note`
- [ ] `mergeCategorySuggestion(id, targetId)` updates `items.category_id` + suggestion row (`status='merged'`, `merged_to_category_id`, `reviewed_at`)
- [ ] All three mutations roll back fully on any sub-step failure

#### `admin-portal/src/services/spConfigService.ts`
- [ ] `calculateCategorySP(categoryId, price)` returns `{ earn_sp: Math.round(price * mult), max_spend_sp: Math.floor(price * cap/100), spend_percent: cap }`
- [ ] `getBonusCategories` filters strictly `sp_earning_multiplier > 1.10 AND is_active = true`; orders DESC
- [ ] `updateCategorySPRates` validates ranges; throws `SPRateOutOfRangeError` on violation; on `notifyUsers=true` enqueues banner via MODULE-14 `NotificationService.enqueueBanner` and resets `sp_rate_change_notify=false`
- [ ] `getSPAnalyticsByCategory(dateRange)` returns `{ category_id, name, velocity, gap_percent, avg_cash_per_trade, anomaly_flags[] }[]`
- [ ] Anomaly flags: `gap_percent > 10` → `'hoarding'`; `velocity < 0.5` → `'low_velocity'`; `velocity > 2` → `'spending_spike'`

#### `p2p-kids-marketplace/src/services/categoryService.ts`
- [ ] `getCategoriesWithCounts(includeInactive=false)` applies `WHERE is_active=true AND item_count>0` by default; orders by `display_order ASC, name ASC`
- [ ] `getCategoriesWithCounts(true)` returns all rows
- [ ] `getBonusCategories` mirrors admin-side contract
- [ ] `calculateCategorySP` matches admin-side math exactly
- [ ] `createCategorySuggestionFromItem` UPSERTs on `UNIQUE (item_id)` conflict (`ON CONFLICT (item_id) DO UPDATE SET suggested_name = EXCLUDED.suggested_name, status='pending', reviewed_at=NULL`)
- [ ] V2 category service exports preserved (backward compatibility)

### 4. ADMIN PAGES & COMPONENTS (ADMIN-V3-004 / 005 / 006)

#### CategoryManagementPage (`/admin/categories`)
- [ ] Route registered under **Settings → Categories**
- [ ] Tabs: "Categories (N)" + "Suggestions (M)" — M is pending suggestion count
- [ ] Search debounced 300ms
- [ ] Filter tabs: All / Active / Inactive / Bonus
- [ ] "+ New Category" CTA opens empty `CategoryForm`

#### CategoryTable
- [ ] Columns: drag-handle, checkbox, icon (+ bonus badge when applicable), name, item_count, SP Earn (inline-editable), SP Spend (inline-editable), Active toggle, Edit/Delete actions
- [ ] DnD reorder → optimistic local update → `reorderCategories` RPC → rollback on error
- [ ] Delete button disabled (with tooltip) when `item_count > 0`
- [ ] Deactivate on non-empty category shows confirmation with count
- [ ] Inline SP cell edit opens a popover editor with same bounds as the form
- [ ] SP cell hover shows preview calculator
- [ ] Bulk select checkboxes; count announced on change
- [ ] Pagination 20/page

#### CategoryForm (3 tabs)
- [ ] Tab 1 Basic Info: name (required, 3–50, regex, unique debounced 500ms), description (max 200), active toggle
- [ ] Tab 2 Icon & Badge: emoji / icon-name / upload sub-tabs for category icon; separate upload for bonus badge; upload preflight validation (type / size / dimensions)
- [ ] Tab 3 SP Config: earning slider 1.05–1.40 step 0.01; spending slider 50–80 step 1; strategy notes (500 char); `sp_rate_change_notify` checkbox; LIVE preview for $50 example
- [ ] Esc closes modal; focus returns to trigger
- [ ] Keyboard navigation between tabs

#### BulkActionsDropdown
- [ ] Appears when ≥ 1 row selected
- [ ] Activate / Deactivate / Delete (disabled unless all selected have `item_count=0`) / Export CSV
- [ ] All actions show confirmation modal with count
- [ ] CSV columns: `id,name,description,is_active,item_count,display_order,sp_earning_multiplier,sp_spending_cap_percent,created_at`

#### CategorySuggestionsList
- [ ] Columns: Suggested Name, Item (link to `/admin/items/{id}` new tab), Seller, Date, Actions
- [ ] Approve opens `ApproveSuggestionModal` (re-uses `CategoryForm`, name pre-filled)
- [ ] Merge opens `MergeSuggestionModal` with active-category dropdown
- [ ] Reject opens `RejectSuggestionModal` with note (optional, 500 char)
- [ ] After action: row removed from pending list; tab badge decrements
- [ ] Pending count via polling (60s) OR Supabase realtime on `category_suggestions` filter `status=eq.pending`

#### SPAnalyticsDashboard (`/admin/sp-analytics`)
- [ ] Date range: 7 / 30 / 90 days; default 30
- [ ] Per-category row: Velocity, Gap %, Avg Cash/Trade
- [ ] Anomaly alerts panel shows flagged categories
- [ ] Clicking a row navigates to `/admin/categories?edit={id}` with SP Config tab focused
- [ ] Export CSV for current date range
- [ ] Initial load < 1s on staging data

### 5. MOBILE INTEGRATION (ADMIN-V3-007)

- [ ] `CategorySelectModal` consumes `getCategoriesWithCounts(false)`; renders `"Name (count)"`
- [ ] Zero-count categories never appear in buyer modal
- [ ] Bonus badge (⭐ or custom `bonus_badge_icon_url`) renders precisely when `sp_earning_multiplier > 1.10` (strict `>`)
- [ ] `PriceSuggestionCard` shows "Earn {earn_sp} SP" and "Buyer can use up to {max_spend_sp} SP" sourced from `calculateCategorySP` (no client re-implementation)
- [ ] `CheckoutScreen` hard-caps SP entry at `max_spend_sp`; values above show inline error
- [ ] `ItemCreateScreen` on publish with "Other":
  - [ ] Calls `createItem` first
  - [ ] Then `flagForCategoryReview(itemId, name)` (existing)
  - [ ] Then `createCategorySuggestionFromItem(itemId, name)` (new; wrapped in try/catch so suggestion failure does NOT fail the publish)
- [ ] `CategoryFilterChip` (MODULE-05 V3) does not render zero-count categories
- [ ] Custom `icon_url` renders via `expo-image`; emoji fallback if image fails
- [ ] `BonusBadge` component present and imported by category UIs

### 6. ADMIN HOOKS (ADMIN-V3-008)

- [ ] `useCategories` uses React Query; key `['categories', { filter }]`
- [ ] Mutations in `useCategoryMutations` invalidate `['categories']` + `['category-suggestions']`
- [ ] `reorderMutation` is optimistic with rollback on error
- [ ] `useCategorySuggestions` subscribes to Supabase realtime on `category_suggestions` where `status=eq.pending`
- [ ] `useSPAnalytics` accepts date range and caches results per range

### 7. TESTS (ADMIN-V3-009)

- [ ] All Jest tests pass in both `admin-portal/` and `p2p-kids-marketplace/`
- [ ] Service coverage ≥ 85% for `categoryService`, `categorySuggestionService`, `spConfigService`
- [ ] PgTAP tests pass (`supabase test db`):
  - [ ] Trigger correctness: INSERT 3 → count=3; UPDATE 1 to sold → count=2; DELETE 1 → count=1
  - [ ] `reorder_categories` raises for non-admin
  - [ ] Second INSERT into `category_suggestions` with same `item_id` triggers UPSERT (or unique violation, per implementation)
- [ ] Playwright flows green on staging:
  - [ ] `category-crud.spec.ts` — create → edit → deactivate → delete
  - [ ] `category-suggestion-approve.spec.ts` — approve → new category + item reassigned
  - [ ] `category-reorder.spec.ts` — DnD persists
  - [ ] `sp-config.spec.ts` — rate change + banner payload enqueued
  - [ ] `bulk-deactivate.spec.ts` — bulk-select 3 → all inactive
- [ ] Maestro flows green on staging:
  - [ ] `buyer-category-filter.yaml` — empty categories hidden
  - [ ] `seller-other-flow.yaml` — "Other" publish → suggestion visible to admin
- [ ] Perf: CategoryManagementPage first render < 1s on 50 categories
- [ ] Perf: `getCategoriesWithCounts` < 300ms with indexes

### 8. CRITICAL RULES ENFORCED (spot-audit)

- [ ] No app code writes to `categories.item_count` (grep confirms trigger-only)
- [ ] `"Other"` category cannot be deactivated or deleted (unit test + runtime guard)
- [ ] SP rate bounds enforced in 3 layers: DB CHECK + service validation + UI slider min/max
- [ ] `reorder_categories` only invoked via RPC, never N individual UPDATEs
- [ ] Category uniqueness is case-insensitive everywhere (DB, service, UI preview)
- [ ] Buyer flows always use `getCategoriesWithCounts(includeInactive=false)` (grep confirms no hardcoded lists)
- [ ] `uploadCategoryIcon` validates PNG/SVG, 500 KB, 100×100 before upload
- [ ] `sp_rate_change_notify` always reset to `false` after banner enqueued
- [ ] Approve/Reject/Merge are transactional (single RPC or explicit txn wrapper)
- [ ] A11y: sliders announce value + range; drag handles ≥ 44×44; modals trap focus

### 9. CROSS-TRACK INTEGRATION

- [ ] MODULE-04 V3 publish-with-Other path writes both `review_flag` AND `category_suggestions`
- [ ] MODULE-05 V3 filter chips source from `getCategoriesWithCounts(false)` and render custom `icon_url`
- [ ] MODULE-09 V2 hardcoded SP constants removed OR wrapped to call `calculateCategorySP`
- [ ] MODULE-14 `NotificationService.enqueueBanner` is the only banner path used (no new notification surface)
- [ ] MODULE-12 V2 admin auth / shell routes unchanged

### 10. OPERATIONS

- [ ] Migrations applied on staging in strict order `000006 → 000010` (optional `000011`)
- [ ] Storage bucket `category-icons` verified: anonymous GET works; anonymous PUT is rejected; admin PUT succeeds
- [ ] Default SP rates (`1.10` / `70`) applied to all pre-existing categories (idempotent SQL verified)
- [ ] Admin portal deployed with new routes `/admin/categories` + `/admin/sp-analytics`
- [ ] Mobile app build references updated service contracts (type-check green)
- [ ] Manual QA: keyboard-only walkthrough of CategoryManagementPage passes
- [ ] Manual QA: screen reader (VoiceOver) announces slider values + bulk-select counts
- [ ] `PROMPTS_USAGE_GUIDE.md` updated with a pointer to MODULE-12 V3

---

## SIGN-OFF

- [ ] Backend engineer: __________________ Date: ______
- [ ] Admin-portal engineer: __________________ Date: ______
- [ ] Mobile engineer: __________________ Date: ______
- [ ] QA: __________________ Date: ______
- [ ] Product: __________________ Date: ______

---

*Verification doc version: 1.0 | Paired with MODULE-12-ADMIN-V3-CATEGORIES.md | Source: ADMIN-CATEGORY-MANAGEMENT.md v1.0*
