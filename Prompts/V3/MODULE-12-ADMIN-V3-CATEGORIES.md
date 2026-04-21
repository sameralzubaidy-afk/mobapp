# MODULE 12: ADMIN PORTAL (V3 — Dynamic Category Management + SP Configuration)

**Version:** 3.0 (Admin-driven Category CRUD + Category Suggestions + Per-Category SP Rates + SP Analytics)
**Status:** Ready for Implementation
**Last Updated:** April 21, 2026
**Dependencies:** MODULE-12 (Admin V2), MODULE-04 V3 (writes `items.requested_category_name`), MODULE-05 V3 (consumes `getCategoriesWithCounts`), MODULE-09 (Points/Swap Points), MODULE-01 (`user_roles`)
**Target Release:** Week 4-6 (MVP Track 2 — parallel with MODULE-04 V3)
**Traceability Source:** `POC1/ai-code-generator/modules/docx/ADMIN-CATEGORY-MANAGEMENT.md` v1.0 (Apr 19, 2026)
**Secondary Sources:** `tmp/SYSTEM_REQUIREMENTS_V2.md`, `tmp/BUSINESS_REQUIREMENTS_DOCUMENT_V2.md`, `tmp/POC desgin.md`

---

## TASKS BREAKDOWN

| # | Task ID | Title | Duration | Priority |
|---|---------|-------|----------|----------|
| 1 | ADMIN-V3-001 | Schema Migrations — Category Columns, Suggestions, Trigger, RPC, Storage | 3h | Critical |
| 2 | ADMIN-V3-002 | Shared Types & Error Classes | 1h | High |
| 3 | ADMIN-V3-003 | Backend Services — Category + Suggestions + SP Config | 6h | Critical |
| 4 | ADMIN-V3-004 | Admin Page — CategoryManagementPage + Table + Form + Bulk Actions | 5h | High |
| 5 | ADMIN-V3-005 | Admin Page — Category Suggestions Queue (Approve / Merge / Reject) | 3h | High |
| 6 | ADMIN-V3-006 | Admin Page — SP Analytics Dashboard | 4h | Medium |
| 7 | ADMIN-V3-007 | Mobile Integration — Bonus Badges, Counts, "Other" Flow, Checkout Cap | 2h | High |
| 8 | ADMIN-V3-008 | Admin Hooks + State (React Query + Realtime) | 2h | Medium |
| 9 | ADMIN-V3-009 | Tests (Unit + Component + PgTAP + Playwright + Maestro) | 5h | High |

**Total estimated effort:** ~31h. Tasks are listed in strict execution order; downstream tasks depend on earlier ones.

---

## V3 OVERVIEW

This module **extends MODULE-12 V2** with full admin-driven category management, replacing the V2 read-only category surface. V3 introduces:

- **Category CRUD** in the admin portal (create/edit/deactivate/delete, drag-and-drop reorder, bulk actions, CSV export).
- **Live item counts** per category via a PostgreSQL trigger on `items`.
- **Category Suggestions queue** — consumes `items.requested_category_name` (written by MODULE-04 V3 when sellers pick "Other") and lets admins **Approve** (creates category + reassigns item), **Merge** (reassign to existing), or **Reject** (leave in "Other" with note).
- **Swap Points (SP) configuration per category** — configurable `sp_earning_multiplier` (1.05–1.40) and `sp_spending_cap_percent` (50–80%) with a live preview calculator.
- **Custom icons + bonus badges** uploaded to Supabase Storage.
- **SP Analytics dashboard** — velocity, gap, cash flow, anomaly detection per category.
- **Optional in-app banner notification** when SP rates change.
- **Buyer-facing filtering**: categories with `item_count = 0` hidden from buyer flows; admin portal still shows all.

V3 is a **Track 2 feature** parallel to MODULE-04 V3. It is the **source of truth for category data** consumed by MODULE-04 V3 (`categoryService.getCategoriesWithCounts`) and MODULE-05 V3 (category filter chip).

V3 **does not** change V2 admin authentication, `user_roles`, or the V2 admin dashboard shell — it adds a dedicated **Settings → Categories** route and a **SP Analytics** route under existing navigation.

---

## CHANGELOG FROM V2 → V3

### V2 Limitations (carried over from MODULE-12 V2)

- Categories hardcoded in `categories` table — no admin UI; changes required a migration.
- No active/inactive toggle — deletion was the only way to hide a category.
- No item count column — admins had no visibility into which categories were empty.
- No seller "Other" flow and no suggestion queue.
- SP earning/spending rates were global constants in code — not per-category.
- No SP analytics (velocity, gap, cash flow) broken out by category.
- No way to upload custom category icons or bonus badges.
- Buyer app showed every category regardless of inventory (UX clutter).

### V3 Enhancements

1. **Schema additions (non-breaking, ALTER TABLE adds columns):**
   - `categories.is_active BOOLEAN NOT NULL DEFAULT true`
   - `categories.item_count INT NOT NULL DEFAULT 0`
   - `categories.display_order INT NOT NULL DEFAULT 0`
   - `categories.description TEXT` (CHECK length ≤ 200)
   - `categories.icon TEXT` (CHECK length ≤ 50) — emoji or icon-library name
   - `categories.icon_url TEXT` — custom uploaded icon (Supabase Storage URL)
   - `categories.bonus_badge_icon_url TEXT` — custom bonus badge (default ⭐)
   - `categories.sp_earning_multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.10` (CHECK 1.05–1.40)
   - `categories.sp_spending_cap_percent INT NOT NULL DEFAULT 70` (CHECK 50–80)
   - `categories.sp_config_notes TEXT` (CHECK length ≤ 500)
   - `categories.sp_rate_change_notify BOOLEAN NOT NULL DEFAULT false`
2. **New table:** `category_suggestions` (seller-requested categories; one per item via `UNIQUE (item_id)`; status pending/approved/rejected/merged).
3. **New trigger:** `update_category_item_count_trigger` on `items` — syncs `categories.item_count` on INSERT/UPDATE(category_id, status)/DELETE.
4. **New RPC:** `reorder_categories(JSONB)` — SECURITY DEFINER, admin-only, batch `display_order` update.
5. **New services:**
   - `CategoryService` — CRUD, toggle, reorder, `getCategoriesWithCounts`, `uploadCategoryIcon`.
   - `CategorySuggestionService` — approve/reject/merge.
   - `SPConfigService` — `calculateCategorySP`, `getBonusCategories`, `updateCategorySPRates`, `getSPAnalyticsByCategory`.
6. **New admin pages:** `CategoryManagementPage` (tabbed: Categories / Suggestions), `SPAnalyticsDashboardPage`.
7. **New admin components:** `CategoryTable`, `CategoryForm` (3 tabs), `CategorySuggestionsList`, `BulkActionsDropdown`, `SPAnalyticsDashboard`.
8. **MODULE-04 V3 hand-off:** `flagForCategoryReview(itemId, name)` now also writes a `category_suggestions` row (not just the `review_flag` row) so the admin suggestions queue is the primary review surface.
9. **MODULE-05 V3 hand-off:** `getCategoriesWithCounts(includeInactive=false)` replaces any hardcoded category list in buyer flows — categories with `item_count = 0` or `is_active = false` are filtered out.
10. **Mobile render:** Bonus badges (⭐ or custom) render next to categories where `sp_earning_multiplier > 1.10`.

---

## CRITICAL V3 RULES FOR ADMIN CATEGORY MODULE

### Rule 1: Category Name Invariants
- Name: 3–50 chars, alphanumeric + spaces only (regex `^[A-Za-z0-9 ]{3,50}$`).
- Uniqueness is **case-insensitive** (compare via `LOWER(name)`). Enforce client-side (debounced 500ms check) AND server-side (create/update service throws `DuplicateNameError`).
- The `"Other"` category is seeded on first run and MUST NOT be deactivatable or deletable (hard rule in `toggleCategoryActive` / `deleteCategory`).

### Rule 2: Delete Is Only Allowed If Empty
- `deleteCategory(id)` MUST refuse unless `item_count = 0`. Return `CategoryNotEmptyError` with the current count; do NOT cascade.
- Bulk delete: only allowed when **every** selected row has `item_count = 0`. If any row is non-empty, disable the action and show the offending rows.

### Rule 3: SP Rate Bounds (enforced DB + client + service)
- `sp_earning_multiplier` ∈ [1.05, 1.40] — DB CHECK, service validation, slider min/max.
- `sp_spending_cap_percent` ∈ [50, 80] — DB CHECK, service validation, input validation.
- These bounds are **legal-safety guardrails** (prevent "1 SP = $1" perception and guarantee ≥ 20% cash on every trade). Do NOT widen them without legal review.
- Preview calculator MUST use the same formulas as runtime (`earn_sp = price × earning_multiplier`; `max_spend_sp = price × (spending_cap_percent / 100)`).

### Rule 4: Item Count Is Trigger-Maintained Only
- `categories.item_count` is **computed and written ONLY by `update_category_item_count_trigger`**. No service writes it directly. Treat it as read-only from the app.
- The trigger fires on `INSERT`, `UPDATE OF category_id, status`, and `DELETE` on `items`. If a new item status is added, the trigger's condition list MUST be extended to include it.
- Initial backfill (`UPDATE categories SET item_count = ...`) is part of the migration.

### Rule 5: Reorder Via RPC Only
- Client calls `reorder_categories(JSONB)` with `[{ id, display_order }, ...]`. Do NOT issue N individual UPDATEs from the client.
- The RPC is `SECURITY DEFINER` and MUST verify `user_roles.role = 'admin'` before performing the updates.
- Admin portal uses optimistic UI — on RPC error, revert the local order and toast the failure.

### Rule 6: Category Suggestions Come From Two Writers
- **MODULE-04 V3 Item Create / Bulk flow** calls `createCategorySuggestionFromItem(itemId, suggestedName)` when the seller picks "Other" and provides a non-empty name. The unique constraint `UNIQUE (item_id)` means re-submitting updates are UPSERT (ON CONFLICT DO UPDATE `suggested_name`, reset `status` to `pending`).
- **Admin-initiated reassignment** (Merge / Approve) is the only path that changes `items.category_id` once the item is published.
- Approving a suggestion MUST be transactional: insert category + UPDATE item + UPDATE suggestion row + SET `reviewed_at` in one txn. Rollback on any failure.

### Rule 7: Buyer-Facing Filter Rules
- Every buyer-facing category read goes through `getCategoriesWithCounts(includeInactive=false)`; the service applies `WHERE is_active = true AND item_count > 0` and orders by `display_order ASC`.
- Admin portal uses `getCategoriesWithCounts(includeInactive=true)` — returns all rows, all orders.
- Sort stability: when `display_order` ties, break by `name ASC` (both DB index and service sort).

### Rule 8: Icon Upload Pipeline
- Accept PNG or SVG only. Max 500 KB. Min dimensions 100 × 100 px. Reject any other type or smaller image with a user-facing error.
- Uploads go to Supabase Storage bucket `category-icons` under `category-icons/{category_id}/{iconType}.{ext}` where `iconType ∈ {'category','bonus_badge'}`.
- After upload, the service writes the **public URL** to `categories.icon_url` (or `.bonus_badge_icon_url`). Never store a local path.
- Uploading a replacement MUST delete the previous object (or overwrite under the same key) to avoid orphaned storage.

### Rule 9: Rate-Change Notification
- `sp_rate_change_notify` is a one-shot admin intent flag: when `updateCategorySPRates` is called with `notifyUsers=true`, it writes the row, enqueues an in-app banner via the existing notification service (MODULE-14), and then MUST reset `sp_rate_change_notify` to `false` at end of the transaction.
- Banner copy MUST reference the category name (e.g. `"Books now earn bonus SP!"`). Users never see the numeric multiplier.

### Rule 10: Accessibility
- All interactive elements have `aria-label` (web) or `accessibilityLabel` (RN) + description/hint.
- SP rate inputs announce value + range (`"1.20×, range 1.05 to 1.40"`).
- Drag handles are ≥ 44 × 44 px touch target and announce "Reorder category, draggable".
- Bulk-select count announced on change: `"3 categories selected"`.
- Modal forms trap focus; Esc closes; focus returns to trigger on close.

### Rule 11: Backward Compatibility
- V2 admin dashboard routes are **unchanged** — the categories route is net-new (`/admin/categories`).
- V2 `categories` rows continue to work — new columns default sensibly (`is_active=true`, `sp_earning_multiplier=1.10`, `sp_spending_cap_percent=70`).
- No existing RLS policy on `categories` is removed; V3 adds admin CRUD policies alongside V2's read policy.

---

## AGENT TEMPLATE

```typescript
/*
YOU ARE AN AI AGENT IMPLEMENTING MODULE-12 ADMIN V3 (DYNAMIC CATEGORY MANAGEMENT + SP CONFIG).

CONTEXT:
- Kids P2P Marketplace. React Native (Expo) mobile app + Next.js admin portal
  (admin-portal/) + Supabase backend.
- MODULE-12 V2 exists: admin shell, auth gating via user_roles, dashboard.
- MODULE-04 V3 will WRITE category_suggestions rows via
  createCategorySuggestionFromItem(itemId, name). Do NOT duplicate that writer.
- MODULE-05 V3 READS getCategoriesWithCounts(includeInactive=false); maintain
  that contract strictly.
- MODULE-14 NotificationService.enqueueBanner exists (use it for SP rate-change
  banners). Do NOT write a new banner system.
- Source of truth: POC1/ai-code-generator/modules/docx/ADMIN-CATEGORY-MANAGEMENT.md v1.0.

YOUR INSTRUCTIONS:
1. Read the entire module before generating any code.
2. Produce a short plan (4-8 steps) and list any missing dependencies.
3. Implement tasks in the order ADMIN-V3-001 … ADMIN-V3-009.
4. For each task: generate files at the exact filepath given; run type-check
   and unit tests; do NOT commit.
5. Migration file numbering (reserve this block for MODULE-12 V3):
     20260420000006_add_category_management_columns.sql
     20260420000007_create_category_suggestions.sql
     20260420000008_category_item_count_trigger.sql
     20260420000009_reorder_categories_rpc.sql
     20260420000010_create_category_icons_storage_bucket.sql
   (Apply strictly in that order.)
6. NEVER write to categories.item_count from app code — trigger-only.
7. Stop and report to the user before running any `supabase db push`,
   `supabase functions deploy`, or storage bucket creation.

VERIFICATION STEPS (print results after each task):
- TypeScript type-check: `npm run type-check` (both admin-portal + mobile).
- Lint: `npm run lint` (both).
- Unit tests:
    Mobile:   `npm test -- --testPathPattern=category|spConfig`
    Admin:    `npm test -- --testPathPattern=category|suggestion|spAnalytics`
- Maestro / Playwright flows: see ADMIN-V3-009.

ERROR HANDLING:
- If duplicate name: throw DuplicateNameError with the conflicting id.
- If delete on non-empty category: throw CategoryNotEmptyError{ count }.
- If SP rate out of range: throw SPRateOutOfRangeError.
- If icon upload fails validation: throw IconUploadError with reason code
  (bad_type | too_large | too_small).
- If reorder RPC 401/403: revert optimistic state, toast "Admin role required".

==================================================
NEXT TASK: ADMIN-V3-001 (Schema — Category Columns, Suggestions, Trigger, RPC, Storage)
==================================================
*/
```

---

## TASK ADMIN-V3-001: Schema Migrations — Category Columns, Suggestions, Trigger, RPC, Storage

**Duration:** 3 hours
**Priority:** Critical (foundational — blocks all other V3 tasks)
**Dependencies:** MODULE-01 (`categories`, `user_roles`, `items`)

### Description

Add the 11 new columns to `categories`, create the `category_suggestions` table, add the `update_category_item_count()` trigger + backfill, add the `reorder_categories()` RPC, and provision the `category-icons` Supabase Storage bucket with RLS.

### Scope

**In scope:**
- 5 Supabase migrations (`20260420000006` – `20260420000010`) in strict order.
- All CHECK constraints, indexes, RLS policies, comments.
- Backfill of `display_order` and initial `item_count`.
- Storage bucket with public read + admin-only write policies.

**Out of scope:**
- Optional `20260420000011_category_suggestion_approve_fn.sql` (created only if client-side transactions prove insufficient in ADMIN-V3-003).
- Materialized view for SP analytics (deferred to follow-up).
- Data seeding beyond defaults baked into the migrations.

### Files to Create

| File | Purpose |
|---|---|
| `supabase/migrations/20260420000006_add_category_management_columns.sql` | ALTER `categories` + 3 indexes + initial `display_order` backfill |
| `supabase/migrations/20260420000007_create_category_suggestions.sql` | `category_suggestions` table + RLS + 2 indexes |
| `supabase/migrations/20260420000008_category_item_count_trigger.sql` | `update_category_item_count()` function + trigger + initial count backfill |
| `supabase/migrations/20260420000009_reorder_categories_rpc.sql` | `reorder_categories(JSONB)` SECURITY DEFINER RPC |
| `supabase/migrations/20260420000010_create_category_icons_storage_bucket.sql` | Bucket `category-icons` (public read, admin write) |

### Acceptance Criteria

- [ ] Five migration files exist at the exact paths above.
- [ ] `categories` has columns `is_active, item_count, display_order, description, icon, icon_url, bonus_badge_icon_url, sp_earning_multiplier, sp_spending_cap_percent, sp_config_notes, sp_rate_change_notify` with the CHECK constraints from § Database Schema Changes.
- [ ] `display_order` backfilled using `ROW_NUMBER() OVER (ORDER BY id)`.
- [ ] Indexes `idx_categories_active` (partial `WHERE is_active=true`), `idx_categories_item_count` (partial), `idx_categories_bonus` (partial `WHERE sp_earning_multiplier > 1.10`) exist.
- [ ] `category_suggestions` table has `id, suggested_name, seller_id, item_id, status, approved_by, merged_to_category_id, admin_note, created_at, reviewed_at`, `UNIQUE (item_id)`, `status IN ('pending','approved','rejected','merged')`.
- [ ] `category_suggestions` RLS: "Admin can manage all suggestions" (FOR ALL via `user_roles`); "Seller can view own suggestions" (FOR SELECT where `seller_id = auth.uid()`).
- [ ] Indexes `idx_category_suggestions_status` (partial WHERE status='pending'), `idx_category_suggestions_seller`.
- [ ] Function `update_category_item_count()` handles INSERT/UPDATE/DELETE; trigger fires `AFTER INSERT OR UPDATE OF category_id, status OR DELETE` on `items`.
- [ ] Initial count backfill runs in the same migration.
- [ ] RPC `reorder_categories(category_orders JSONB)` is `SECURITY DEFINER`, checks admin role, updates `display_order` in a loop using `jsonb_to_recordset`.
- [ ] Storage bucket `category-icons` created (public read; insert/update/delete restricted to admins via storage RLS policy using `user_roles`).
- [ ] All migrations idempotent (`IF NOT EXISTS`, `CREATE OR REPLACE`).
- [ ] Commented-out verification queries at the bottom of each file.

### AI Prompt for Cursor

````text
TASK: Generate 5 Supabase migrations for MODULE-12 V3.

CONTEXT:
- `categories` and `items` tables exist. `user_roles(user_id, role)` exists.
- Some `categories` rows already exist (seeded by MODULE-01); preserve them.
- Do NOT reorder the existing MODULE-04 V3 / MODULE-05 V3 migration numbers
  (20260420000001..5). Use 000006..000010 exclusively.

REQUIREMENTS (verbatim from ADMIN-CATEGORY-MANAGEMENT.md § Database Schema Changes):

FILE 1: 20260420000006_add_category_management_columns.sql
- ALTER TABLE categories ADD COLUMN IF NOT EXISTS ... for all 11 columns.
- CHECK constraints: sp_earning_multiplier BETWEEN 1.05 AND 1.40;
  sp_spending_cap_percent BETWEEN 50 AND 80; description/icon/sp_config_notes
  length CHECKs.
- UPDATE categories SET display_order = ROW_NUMBER() OVER (ORDER BY id);
- 3 indexes as listed above.
- COMMENT ON COLUMN for every new column.

FILE 2: 20260420000007_create_category_suggestions.sql
- Create table exactly as specified (incl. UNIQUE(item_id)).
- Enable RLS; 2 policies.
- 2 indexes.

FILE 3: 20260420000008_category_item_count_trigger.sql
- CREATE OR REPLACE FUNCTION update_category_item_count() as specified.
- DROP TRIGGER IF EXISTS ... ; CREATE TRIGGER update_category_item_count_trigger
    AFTER INSERT OR UPDATE OF category_id, status OR DELETE
    ON public.items FOR EACH ROW EXECUTE FUNCTION update_category_item_count().
- Initial UPDATE categories SET item_count = (SELECT COUNT(*) ... WHERE status='available').

FILE 4: 20260420000009_reorder_categories_rpc.sql
- CREATE OR REPLACE FUNCTION reorder_categories(category_orders JSONB)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ ... $$.
- Admin role check up-front; RAISE EXCEPTION on failure.
- FOR loop over jsonb_to_recordset.

FILE 5: 20260420000010_create_category_icons_storage_bucket.sql
- INSERT INTO storage.buckets (id, name, public) VALUES ('category-icons','category-icons',true)
  ON CONFLICT (id) DO NOTHING.
- Storage policies: anyone can SELECT (public read); INSERT/UPDATE/DELETE
  restricted to admins via user_roles EXISTS check.

OUTPUT 5 FILES, each starting with `--- FILE: <path> ---`.

VERIFICATION QUERIES at bottom of each file (commented):
- File 1: SELECT column_name FROM information_schema.columns WHERE table_name='categories' AND column_name IN (...);
- File 2: SELECT tablename, policyname FROM pg_policies WHERE tablename='category_suggestions';
- File 3: SELECT tgname FROM pg_trigger WHERE tgrelid='items'::regclass AND tgname='update_category_item_count_trigger';
- File 4: SELECT proname, prosecdef FROM pg_proc WHERE proname='reorder_categories';
- File 5: SELECT id, public FROM storage.buckets WHERE id='category-icons';
````

---

## TASK ADMIN-V3-002: Shared Types & Error Classes

**Duration:** 1 hour
**Priority:** High
**Dependencies:** ADMIN-V3-001

### Description

Define the shared TypeScript types (`Category`, `CategorySuggestion`, `CategorySPAnalytics`, `BonusCategory`, `ValidationResult`) and typed error classes used by admin services, admin UI, and the mobile mirror.

### Scope

**In scope:**
- 2 admin-portal type files + 1 mobile mirror type file.
- Stable `code` strings on all error classes for client-side switch handling.
- Strict TS — no `any`.

**Out of scope:**
- Runtime validation libraries (zod, yup).
- Service or component implementations.
- Mobile reuse of admin-only fields.

### Files

| Path | Purpose |
|---|---|
| `admin-portal/src/types/category.ts` | `Category`, `CreateCategoryInput`, `UpdateCategoryInput`, `CategorySuggestion`, `SuggestionStatus`, `CategorySPAnalytics`, `BonusCategory`, `ValidationResult` |
| `admin-portal/src/types/errors.ts` | `DuplicateNameError`, `CategoryNotEmptyError`, `SPRateOutOfRangeError`, `IconUploadError`, `UnauthorizedError` |
| `p2p-kids-marketplace/src/types/category.ts` | Mobile-side mirror of `Category` + `BonusCategory` (subset — no admin fields) |

### Acceptance Criteria

- [ ] `Category` type includes every column from the migration, with `sp_earning_multiplier: number` and `sp_spending_cap_percent: number` (narrow branded types optional).
- [ ] `SuggestionStatus = 'pending' | 'approved' | 'rejected' | 'merged'`.
- [ ] Error classes extend `Error` and carry a stable `code` string (e.g. `DUPLICATE_NAME`) for client switch-statements.
- [ ] Mobile type file does NOT import from `admin-portal` (independent packages).
- [ ] Strict TypeScript — no `any`.

---

## TASK ADMIN-V3-003: Backend Services — Category + Suggestions + SP Config

**Duration:** 6 hours
**Priority:** Critical
**Dependencies:** ADMIN-V3-001, ADMIN-V3-002

### Description

Implement the admin-portal backend services (Category CRUD, Category Suggestions review, SP Config + Analytics) and add the mobile-side additions to `categoryService` that MODULE-04 V3 and MODULE-05 V3 consume (`getCategoriesWithCounts`, `calculateCategorySP`, `createCategorySuggestionFromItem`, `getBonusCategories`).

### Scope

**In scope:**
- 3 new admin-portal service files + 1 modified mobile `categoryService` (preserve V2 exports).
- Transactional approve / merge flow (optionally via migration `20260420000011`).
- Icon-upload pipeline with preflight validation and prior-object cleanup.
- Per-category SP math (`Math.round` earn, `Math.floor` spend) identical on both platforms.

**Out of scope:**
- Admin UI and mobile UI (later tasks).
- Realtime subscriptions (ADMIN-V3-008).
- Materialized view creation for analytics.

### Files to Create / Modify

| Path | Action | Key Exports |
|---|---|---|
| `admin-portal/src/services/categoryService.ts` | NEW | `createCategory`, `updateCategory`, `deleteCategory`, `getCategoriesWithCounts`, `toggleCategoryActive`, `reorderCategories`, `uploadCategoryIcon`, `validateCategoryName`, `checkCategoryUniqueness` |
| `admin-portal/src/services/categorySuggestionService.ts` | NEW | `getCategorySuggestions`, `approveCategorySuggestion`, `rejectCategorySuggestion`, `mergeCategorySuggestion` |
| `admin-portal/src/services/spConfigService.ts` | NEW | `calculateCategorySP`, `getBonusCategories`, `updateCategorySPRates`, `getSPAnalyticsByCategory` |
| `p2p-kids-marketplace/src/services/categoryService.ts` | MODIFY | ADD `getCategoriesWithCounts`, `getBonusCategories`, `calculateCategorySP`, `createCategorySuggestionFromItem` (consumed by MODULE-04 V3) |

### Acceptance Criteria (per function — abridged)

- [ ] `createCategory(input)` validates name (regex, 3–50, unique case-insensitive) → inserts with `display_order = COALESCE(MAX(display_order),0)+1` → returns full row.
- [ ] `updateCategory(id, updates)` rejects attempts to write `item_count`; re-checks uniqueness if `name` changed.
- [ ] `deleteCategory(id)` SELECTs `item_count` first; throws `CategoryNotEmptyError` if > 0; hard DELETEs otherwise.
- [ ] `toggleCategoryActive(id, isActive)` refuses if the category is the seeded "Other" row.
- [ ] `reorderCategories(orders)` calls the RPC in ONE request (no N+1).
- [ ] `uploadCategoryIcon(categoryId, file, type)` validates type (PNG/SVG), size ≤ 500 KB, dimensions ≥ 100×100; uploads via `supabase.storage.from('category-icons')`; writes public URL into the appropriate column; returns the URL.
- [ ] `approveCategorySuggestion(id, data)` runs in a single transaction: insert category → UPDATE `items.category_id` for the linked item → UPDATE suggestion row (`status='approved'`, `approved_by`, `reviewed_at=now()`). Rolls back on any failure.
- [ ] `rejectCategorySuggestion(id, note?)` sets `status='rejected'`, `reviewed_at`, optional `admin_note`. Item stays put.
- [ ] `mergeCategorySuggestion(id, targetCategoryId)` UPDATE `items.category_id = targetCategoryId` + suggestion row (`status='merged'`, `merged_to_category_id`, `reviewed_at`).
- [ ] `calculateCategorySP(categoryId, price)` → `{ earn_sp: round(price * multiplier), max_spend_sp: floor(price * cap/100), spend_percent: cap }`. Rounding: `earn_sp` rounds to nearest int, `max_spend_sp` floors (never lets buyer exceed cap).
- [ ] `getBonusCategories()` filters `sp_earning_multiplier > 1.10 AND is_active = true`, order DESC.
- [ ] `updateCategorySPRates(id, earn, cap, notify, notes?)` validates ranges, updates row, if `notify=true` enqueues banner via MODULE-14 `NotificationService.enqueueBanner` and resets `sp_rate_change_notify=false` at txn end.
- [ ] `getSPAnalyticsByCategory(dateRange)` aggregates `points_transactions` + `items` sold in range; returns per-category `{ velocity, gap_percent, avg_cash_per_trade, anomaly_flags[] }`.
- [ ] Mobile `createCategorySuggestionFromItem(itemId, name)` UPSERTs on `UNIQUE (item_id)` conflict (`ON CONFLICT (item_id) DO UPDATE SET suggested_name = EXCLUDED.suggested_name, status = 'pending', reviewed_at = NULL`).
- [ ] Unit tests in `admin-portal/src/__tests__/services/` and `p2p-kids-marketplace/src/__tests__/services/` (see ADMIN-V3-009).

### AI Prompt for Cursor

````text
TASK: Implement MODULE-12 V3 backend services.

CONTEXT:
- Admin portal uses @supabase/supabase-js with a service-role client that is
  still gated by user_roles (server-side admin verification).
- Mobile client uses anon client + auth.uid() RLS.
- MODULE-14 exposes NotificationService.enqueueBanner({ userId, payload }) on
  the server side — call it from updateCategorySPRates when notify=true.

DELIVER 4 service files (3 new admin-portal, 1 modified mobile).

HARD RULES:
- Never write categories.item_count from app code.
- Approve/Reject/Merge must be transactional (use Postgres function if the
  Supabase client cannot express multi-statement transactions inline — create
  supabase/migrations/20260420000011_category_suggestion_approve_fn.sql with
  approve_category_suggestion(suggestion_id UUID, category_data JSONB) and
  merge_category_suggestion(suggestion_id UUID, target_id UUID) RPCs).
- validateCategoryName MUST reject anything that doesn't match
  /^[A-Za-z0-9 ]{3,50}$/ (returns {valid:false, error:'...'} — do not throw).
- calculateCategorySP rounding: earn_sp = Math.round, max_spend_sp = Math.floor.
- uploadCategoryIcon MUST delete any prior object at the same key before writing.
````

---

## TASK ADMIN-V3-004: Admin Page — CategoryManagementPage

**Duration:** 5 hours
**Priority:** High
**Dependencies:** ADMIN-V3-003

### Description

New top-level admin page at route `/admin/categories` with two tabs: **Categories** (CRUD table with drag-and-drop, inline SP editing, bulk actions) and **Suggestions** (review queue with pending-count badge). Includes the 3-tab `CategoryForm` modal (Basic Info / Icon & Badge / SP Config) with a live preview calculator.

### Scope

**In scope:**
- 1 page + 4 components (`CategoryTable`, `CategoryForm`, `BulkActionsDropdown`, `CategoryRow`).
- DnD reorder with optimistic UI + rollback on error.
- Inline SP rate edit + hover preview.
- CSV export.

**Out of scope:**
- Suggestions queue modals (ADMIN-V3-005).
- SP Analytics page (ADMIN-V3-006).
- Mobile changes.
- Tests (ADMIN-V3-009).

### Files

| Path | Purpose |
|---|---|
| `admin-portal/src/pages/CategoryManagementPage.tsx` | Tabbed container + search + filters + "+ New Category" CTA |
| `admin-portal/src/components/category/CategoryTable.tsx` | DnD table w/ bulk-select, inline edit, item count, SP columns, Active toggle |
| `admin-portal/src/components/category/CategoryForm.tsx` | 3-tab modal (Basic Info / Icon & Badge / SP Config) with live preview |
| `admin-portal/src/components/category/BulkActionsDropdown.tsx` | Activate / Deactivate / Delete (conditional) / Export CSV |
| `admin-portal/src/components/category/CategoryRow.tsx` | Row renderer (so DnD lib has a stable item) |

### Acceptance Criteria

- [ ] Route `/admin/categories` registered in admin navigation under **Settings → Categories**.
- [ ] Tabs: "Categories (N)" and "Suggestions (M)" where M is the pending suggestion count (polled every 60s OR via realtime subscription).
- [ ] Search input debounced 300ms, filters by name.
- [ ] Filter tabs: All / Active / Inactive / Bonus (`sp_earning_multiplier > 1.10`).
- [ ] Table columns exactly as listed in § Admin Portal Architecture: drag-handle, checkbox, icon (+ bonus badge), name, item_count, SP Earn (click to edit inline), SP Spend (click to edit inline), Active toggle, Edit/Delete actions.
- [ ] Drag-and-drop rows to reorder → optimistic local update → `reorderCategories` RPC → on failure, revert + error toast.
- [ ] Click row / Edit button → opens `CategoryForm` modal pre-filled with row data. Submitting PATCHes via `updateCategory`.
- [ ] "+ New Category" → opens empty `CategoryForm`. On success, row appears at the top of the filtered list.
- [ ] `CategoryForm` tabs:
  - [ ] **Basic Info** — name (required, 3–50, unique check debounced), description (optional, max 200), active toggle.
  - [ ] **Icon & Badge** — emoji / icon-name / upload tabs; upload validates before calling `uploadCategoryIcon`; bonus badge upload is a separate sub-field.
  - [ ] **SP Config** — earning multiplier (slider 1.05–1.40, step 0.01), spending cap (slider 50–80, step 1), strategy notes (textarea, 500 char), notify checkbox, LIVE preview panel for a $50 sample price.
- [ ] Bulk actions: disable Delete unless every selected row has `item_count=0`; confirmation modal shows exact count.
- [ ] Deactivate with `item_count>0` → confirmation modal reads `"N items will be hidden from search"`.
- [ ] Export CSV: columns `id,name,description,is_active,item_count,display_order,sp_earning_multiplier,sp_spending_cap_percent,created_at`. Download triggered client-side.
- [ ] Full a11y: every button/input has label + keyboard flow; Esc closes modal; focus returns to trigger.

### AI Prompt for Cursor

````text
TASK: Build CategoryManagementPage + 4 components.

DELIVER 5 files under admin-portal/src/. Use the existing admin-portal stack
(Next.js app router, Tailwind, shadcn/ui). Use @dnd-kit/sortable for DnD.

HARD RULES:
- CategoryTable is presentational — all data fetching lives in the page.
- CategoryForm validates on blur + on submit; uniqueness check debounced 500ms.
- SP preview updates on every slider change (no debounce — client-side math only).
- Delete button is disabled (aria-disabled + tooltip "Category has N items") when
  item_count > 0.
- Never mutate the incoming categories prop; always spread.

No tests in this task — they live in ADMIN-V3-009.
````

---

## TASK ADMIN-V3-005: Admin Page — Category Suggestions Queue

**Duration:** 3 hours
**Priority:** High
**Dependencies:** ADMIN-V3-003, ADMIN-V3-004

### Description

Build the Category Suggestions queue (list + Approve / Merge / Reject modals) that consumes seller-submitted "Other" category suggestions. Approving creates a new category and reassigns the originating item in a single transaction; merging reassigns the item to an existing category; rejecting leaves the item in "Other" with an optional admin note.

### Scope

**In scope:**
- 1 list component + 3 modal components.
- Realtime pending-count (or 60s polling fallback).
- Re-use of `CategoryForm` inside `ApproveSuggestionModal`.

**Out of scope:**
- The Suggestions tab shell (already built in ADMIN-V3-004).
- Mobile-side "Other" flow (ADMIN-V3-007).
- Tests (ADMIN-V3-009).

### Files

| Path | Purpose |
|---|---|
| `admin-portal/src/components/category/CategorySuggestionsList.tsx` | Table + actions (Approve / Merge / Reject) |
| `admin-portal/src/components/category/ApproveSuggestionModal.tsx` | Re-uses `CategoryForm` pre-filled with suggested name |
| `admin-portal/src/components/category/MergeSuggestionModal.tsx` | Dropdown of existing categories |
| `admin-portal/src/components/category/RejectSuggestionModal.tsx` | Note field (optional, 500 char) |

### Acceptance Criteria

- [ ] Suggestions tab lists `getCategorySuggestions('pending')` results.
- [ ] Columns: Suggested Name, Item (link opens `/admin/items/{id}` in new tab), Seller (name + id), Date (relative), Actions (Approve ✅, Merge 🔀, Reject ❌).
- [ ] **Approve** opens `ApproveSuggestionModal` which re-uses `CategoryForm` with `name` pre-filled and `active` defaulted to true; submit calls `approveCategorySuggestion(id, data)`.
- [ ] **Merge** opens dropdown of active categories; submit calls `mergeCategorySuggestion(id, targetId)`; the linked item's `category_id` changes.
- [ ] **Reject** opens note field; submit calls `rejectCategorySuggestion(id, note)`.
- [ ] After any action: row removed from pending list; badge count on tab decrements.
- [ ] Pending badge count polled every 60s (or use Supabase realtime on the `category_suggestions` channel filtered `status=eq.pending`).

---

## TASK ADMIN-V3-006: Admin Page — SP Analytics Dashboard

**Duration:** 4 hours
**Priority:** Medium
**Dependencies:** ADMIN-V3-003

### Description

Build the SP Analytics dashboard page showing per-category velocity, gap %, and average cash-flow metrics with anomaly flagging (hoarding, low velocity, spending spike) and CSV export. Clicking a category deep-links to the SP Config tab in `CategoryForm`.

### Scope

**In scope:**
- 1 new page + 4 components (`SPAnalyticsDashboard`, `SPMetricsTable`, `SPAnomalyAlerts`, `DateRangePicker`).
- Date range: 7 / 30 / 90 days (default 30).
- CSV export of the current snapshot.

**Out of scope:**
- Materialized views for pre-aggregation (follow-up migration if perf insufficient).
- ML-based anomaly detection.
- Realtime refresh.
- Tests (ADMIN-V3-009).

### Files

| Path | Purpose |
|---|---|
| `admin-portal/src/pages/SPAnalyticsDashboardPage.tsx` | Route `/admin/sp-analytics` |
| `admin-portal/src/components/spconfig/SPAnalyticsDashboard.tsx` | Table + alerts panel |
| `admin-portal/src/components/spconfig/SPMetricsTable.tsx` | Per-category row: velocity / gap / cash flow |
| `admin-portal/src/components/spconfig/SPAnomalyAlerts.tsx` | Flagged categories list |
| `admin-portal/src/components/spconfig/DateRangePicker.tsx` | "Last 30 days" default (reuse existing if present) |

### Acceptance Criteria

- [ ] Route `/admin/sp-analytics` registered and nav-linked under **Settings → SP Analytics**.
- [ ] Date range: Last 7 / 30 / 90 days; default 30.
- [ ] Metrics per category:
  - **Velocity** = `total_sp_spent / total_sp_earned` (in range).
  - **Gap %** = `(earned - spent) / earned * 100`.
  - **Avg Cash / Trade** = `sum(cash_component) / trade_count`.
- [ ] Anomaly flags:
  - `gap_percent > 10` → "hoarding".
  - `velocity < 0.5` → "low velocity".
  - `velocity > 2` → "spending spike".
- [ ] Clicking a category row navigates to `/admin/categories?edit={id}` with SP Config tab focused.
- [ ] Export CSV button downloads the current date-ranged snapshot.
- [ ] Dashboard initial load < 1s on staging data (use pre-aggregated view if needed — see implementation note below).

**Implementation note:** If raw aggregation is slow, create a materialized view `mv_sp_analytics_by_category_daily` in a follow-up migration and refresh nightly.

---

## TASK ADMIN-V3-007: Mobile Integration — Bonus Badges, Item Counts, Other Flow Wiring

**Duration:** 2 hours
**Priority:** High
**Dependencies:** ADMIN-V3-003, MODULE-04 V3 (screen already rebuilt), MODULE-05 V3

### Description

Wire the mobile app to the new admin-owned category data layer: render bonus badges, show `"Name (count)"` in buyer flows, enforce the SP spending cap in checkout, and dual-write "Other" suggestions so the admin queue (MODULE-12 V3) receives them in addition to the existing `review_flag` path.

### Scope

**In scope:**
- 5 mobile file modifications + 1 new `BonusBadge` component.
- Wrapping `createCategorySuggestionFromItem` in try/catch so publish never fails because of a suggestion write.
- Using `getCategoriesWithCounts(false)` everywhere buyer-facing.

**Out of scope:**
- Admin portal UI.
- New mobile screens.
- Tests (ADMIN-V3-009).

### Files

| Path | Action | Purpose |
|---|---|---|
| `p2p-kids-marketplace/src/components/listing/CategorySelectModal.tsx` | MODIFY | Consume `getCategoriesWithCounts(false)`; render `"Name (count)"`; render ⭐ / custom bonus badge when `sp_earning_multiplier > 1.10` |
| `p2p-kids-marketplace/src/components/listing/PriceSuggestionCard.tsx` | MODIFY | Pull `calculateCategorySP(categoryId, price)` and show "Earn {earn_sp} SP" and "Buyer can use up to {max_spend_sp} SP" |
| `p2p-kids-marketplace/src/screens/ItemCreateScreen.tsx` | MODIFY | After publish with `category_id === 'other'`, call `createCategorySuggestionFromItem(itemId, requestedName)` (ADDITIONAL to existing `flagForCategoryReview`) |
| `p2p-kids-marketplace/src/screens/checkout/CheckoutScreen.tsx` | MODIFY | Enforce `max_spend_sp` from `calculateCategorySP` — slider / input cap |
| `p2p-kids-marketplace/src/components/discovery/CategoryFilterChip.tsx` | MODIFY | Hide categories with `item_count=0` (already filtered by service — ensure no client-side override bypasses it) |
| `p2p-kids-marketplace/src/components/shared/BonusBadge.tsx` | NEW | Renders `<Image source={{ uri: bonus_badge_icon_url }} />` falling back to ⭐ emoji |

### Acceptance Criteria

- [ ] Buyer category modal never shows a zero-count category.
- [ ] Bonus badge renders precisely when `sp_earning_multiplier > 1.10` (strict `>`).
- [ ] PriceSuggestionCard SP text matches server calculation to the unit (use `calculateCategorySP` — do NOT re-implement).
- [ ] CheckoutScreen hard-caps SP entry at `max_spend_sp`; input above that shows inline error.
- [ ] Publishing an "Other" item writes to BOTH `review_flag` (existing) AND `category_suggestions` (via UPSERT) — order: `createItem` → `flagForCategoryReview` → `createCategorySuggestionFromItem`.
- [ ] Custom category icons (`icon_url`) render via `expo-image` with graceful fallback to emoji.

---

## TASK ADMIN-V3-008: Admin Hooks + State

**Duration:** 2 hours
**Priority:** Medium
**Dependencies:** ADMIN-V3-003

### Description

Provide the React Query hooks that back the admin portal UI: category list + filters, pending-suggestion realtime subscription, CRUD mutations with optimistic reorder rollback, and date-ranged SP analytics fetch.

### Scope

**In scope:**
- 4 hook files under `admin-portal/src/hooks/`.
- Cache invalidation keys (`['categories']`, `['category-suggestions']`).
- Optimistic reorder with rollback on error.
- Supabase realtime subscription filtered `status=eq.pending`.

**Out of scope:**
- Service implementations (ADMIN-V3-003).
- Component integration details (ADMIN-V3-004 – 006).
- Tests (ADMIN-V3-009).

### Files

| Path | Purpose |
|---|---|
| `admin-portal/src/hooks/useCategories.ts` | Fetch + cache categories (React Query) with invalidation on mutations |
| `admin-portal/src/hooks/useCategorySuggestions.ts` | Pending suggestions subscription |
| `admin-portal/src/hooks/useCategoryMutations.ts` | `createMutation`, `updateMutation`, `deleteMutation`, `toggleMutation`, `reorderMutation` |
| `admin-portal/src/hooks/useSPAnalytics.ts` | Date-ranged SP analytics fetch |

### Acceptance Criteria

- [ ] Uses React Query (`@tanstack/react-query`) — already in admin-portal.
- [ ] Mutations invalidate `['categories']` and `['category-suggestions']` query keys.
- [ ] `reorderMutation` is optimistic: the local array is reordered before the network call; rollback on error.
- [ ] `useCategorySuggestions` subscribes via Supabase realtime to `category_suggestions` (filter: `status=eq.pending`) so the badge count updates in real time.

---

## TASK ADMIN-V3-009: Tests (Unit + Integration + E2E)

**Duration:** 5 hours
**Priority:** High
**Dependencies:** ADMIN-V3-003 … ADMIN-V3-008

### Description

Ship the full test package for MODULE-12 V3: Jest unit tests for services, component tests, PgTAP DB tests (trigger correctness, RPC admin guard, suggestion uniqueness), Playwright E2E for admin portal, and Maestro for mobile cross-integration.

### Scope

**In scope:**
- 8 Jest suites (admin services + components + hooks + mobile services).
- 1 PgTAP SQL file.
- 5 Playwright specs under `admin-portal/e2e/`.
- 2 Maestro flows under `p2p-kids-marketplace/e2e/`.
- Coverage target ≥ 85% for admin services.

**Out of scope:**
- Visual-regression tests.
- Load testing.
- CI pipeline wiring (tracked separately).

### Test Files

| Path | Covers |
|---|---|
| `admin-portal/src/__tests__/services/categoryService.test.ts` | CRUD + validation + uniqueness + delete-guard |
| `admin-portal/src/__tests__/services/categorySuggestionService.test.ts` | approve / reject / merge transactional behavior (mocked) |
| `admin-portal/src/__tests__/services/spConfigService.test.ts` | `calculateCategorySP` rounding, range validation, analytics aggregation |
| `admin-portal/src/__tests__/components/CategoryTable.test.tsx` | Row rendering, disabled-delete for non-empty, bulk select, DnD handler called |
| `admin-portal/src/__tests__/components/CategoryForm.test.tsx` | 3-tab navigation, live preview math, validation, slider bounds |
| `admin-portal/src/__tests__/hooks/useCategoryMutations.test.tsx` | Optimistic reorder rollback |
| `p2p-kids-marketplace/src/__tests__/services/categoryService.test.ts` | `getCategoriesWithCounts` filters, `createCategorySuggestionFromItem` UPSERT |
| `p2p-kids-marketplace/src/__tests__/services/spConfigService.test.ts` | `calculateCategorySP` matches server |
| `supabase/tests/category_management.sql` | PgTAP: item-count trigger correctness; reorder RPC admin guard; `UNIQUE (item_id)` on suggestions |
| `admin-portal/e2e/category-crud.spec.ts` | Playwright: create → edit → deactivate → delete |
| `admin-portal/e2e/category-suggestion-approve.spec.ts` | Playwright: approve → verify category + item reassigned |
| `admin-portal/e2e/category-reorder.spec.ts` | Playwright: DnD reorder persists |
| `admin-portal/e2e/sp-config.spec.ts` | Playwright: change SP rates, verify preview + notification banner payload |
| `admin-portal/e2e/bulk-deactivate.spec.ts` | Playwright: bulk-select 3 → deactivate → verify |
| `p2p-kids-marketplace/e2e/buyer-category-filter.yaml` | Maestro: empty categories hidden from buyer modal |
| `p2p-kids-marketplace/e2e/seller-other-flow.yaml` | Maestro: list with "Other" → suggestion appears in admin |

### Acceptance Criteria

- [ ] All Jest tests pass in both packages.
- [ ] Coverage for `admin-portal/src/services/{category,categorySuggestion,spConfig}Service.ts` ≥ 85%.
- [ ] PgTAP tests pass (`supabase test db`):
  - Insert 3 items → assert `item_count=3`; update 1 to `status='sold'` → `item_count=2`; delete 1 → `item_count=1`.
  - Non-admin calling `reorder_categories` → exception.
  - Second INSERT into `category_suggestions` with same `item_id` → UNIQUE violation (or UPSERT behavior as implemented).
- [ ] Playwright flows green on staging (5 flows) — documented in PR.
- [ ] Maestro flows green on a staging build (2 flows).
- [ ] Perf spot-check: CategoryManagementPage initial load < 1s with 50 categories (seeded).

---

## CROSS-TRACK INTEGRATION NOTES

- **MODULE-04 V3 (Item Listing — Track 2):** V3 here OWNS the category data layer. MODULE-04 V3's `flagForCategoryReview` must be followed by `createCategorySuggestionFromItem` so admins see the suggestion in the new queue (not just a generic review_flag). Publish MUST still succeed even if the suggestion write fails (try/catch + log).
- **MODULE-05 V3 (Discovery — Track 1):** Buyer filter chips consume `getCategoriesWithCounts(includeInactive=false)`. Any custom icon (`icon_url`) renders in the chip. When `item_count=0`, the chip is not rendered at all.
- **MODULE-09 (Swap Points):** `calculateCategorySP` is the **only** allowed formula for per-item SP calculations. Legacy global constants in MODULE-09 V2 MUST be removed (or wrapped to call this service) before V3 ships.
- **MODULE-14 (Notifications):** `updateCategorySPRates(..., notifyUsers=true)` calls `NotificationService.enqueueBanner` — no new notification surface is introduced here.
- **MODULE-12 V2:** V2 admin auth / shell unchanged. V3 pages mount inside the existing layout.

---

## OUT OF SCOPE (Post-MVP)

- Nested subcategories (tree model).
- Category merge tool (bulk reassign many items to one category).
- Category analytics (views, conversions, CTR).
- Category templates (pre-fill description/icon on create).
- Multi-level approval workflow for suggestions.
- Category aliases / synonyms for search.
- Category translations / i18n.
- ML-based dynamic SP rate automation.
- Category-specific transaction fees.
- Bulk CSV import of categories.

---

## IMPLEMENTATION CHECKLIST (high-level)

- [ ] ADMIN-V3-001 — schema migrations (columns, suggestions, trigger, RPC, storage bucket)
- [ ] ADMIN-V3-002 — shared types + error classes (admin + mobile)
- [ ] ADMIN-V3-003 — services (Category, CategorySuggestion, SPConfig) + mobile additions
- [ ] ADMIN-V3-004 — `CategoryManagementPage` + table + form + bulk actions
- [ ] ADMIN-V3-005 — Suggestions queue + Approve/Merge/Reject modals
- [ ] ADMIN-V3-006 — SP Analytics dashboard page
- [ ] ADMIN-V3-007 — mobile integration (bonus badges, counts, Other flow wiring, checkout cap)
- [ ] ADMIN-V3-008 — admin hooks (React Query + realtime)
- [ ] ADMIN-V3-009 — tests (Jest + PgTAP + Playwright + Maestro)
- [ ] Apply migrations on staging; create storage bucket; verify RLS
- [ ] Seed default SP rates (1.10× / 70%) on all existing categories (idempotent SQL in migration)
- [ ] Manual QA with keyboard + screen reader on admin portal
- [ ] Update `PROMPTS_USAGE_GUIDE.md` with a pointer to this module

---

*Document version: 1.0 | Generated from ADMIN-CATEGORY-MANAGEMENT.md v1.0 | Cross-refs: SYSTEM_REQUIREMENTS_V2.md, BUSINESS_REQUIREMENTS_DOCUMENT_V2.md, POC desgin.md | Next review: after Track 2 implementation*
