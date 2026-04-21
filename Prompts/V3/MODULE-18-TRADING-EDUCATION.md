# MODULE 18: TRADING EDUCATION (V1 — Configurable "How It Works" + Category-Aware SP Calculator)

**Version:** 1.0 (new module — no V2 predecessor)
**Status:** Ready for Implementation
**Last Updated:** April 21, 2026
**Dependencies:** MODULE-12 V3 (`categories.sp_earning_multiplier`, `categories.sp_spending_cap_percent`, `categories.bonus_badge_icon_url`), MODULE-09 V2 (SP balance + fee model), MODULE-03 V2 (Settings shell), MODULE-01 (`user_roles`, `user_profiles`)
**Target Release:** Week 7-8 (MVP Track 4 — parallel with AUTH-V3 / Track 3)
**Traceability Source:** `POC1/ai-code-generator/modules/docx/TRADING-EDUCATION-REQUIREMENTS.md` v1.0 (Apr 20, 2026)
**Secondary Sources:** `tmp/SYSTEM_REQUIREMENTS_V2.md`, `tmp/BUSINESS_REQUIREMENTS_DOCUMENT_V2.md`, `tmp/POC desgin.md`

---

## TASKS BREAKDOWN

| # | Task ID | Title | Duration | Priority |
|---|---------|-------|----------|----------|
| 1 | EDU-001 | Schema Migrations — Sections, Examples, Analytics + Seed | 3h | Critical |
| 2 | EDU-002 | Shared Types & Error Classes (Sections / Examples / Calculator / Analytics) | 1h | High |
| 3 | EDU-003 | Backend Services — Content + Example + SP Calculator + Analytics | 4h | Critical |
| 4 | EDU-004 | Mobile UI — OnboardingCarousel + First-Run Gating | 3h | High |
| 5 | EDU-005 | Mobile UI — HelpScreen (Accordion + Embedded Calculator + Bonus Categories) | 3h | High |
| 6 | EDU-006 | Mobile UI — SPCalculator widget (Help + Sell + Checkout placements) + BonusCategoryBadge | 3h | High |
| 7 | EDU-007 | Mobile UI — Contextual Prompts (First Listing + First Purchase) | 2h | Medium |
| 8 | EDU-008 | Admin Portal — EducationContentPage (Sections + Examples + Preview) | 4h | High |
| 9 | EDU-009 | Admin Portal — AnalyticsDashboard (Onboarding + Help + Calculator Metrics) | 2h | Medium |
| 10 | EDU-010 | Tests (Jest unit + component + PgTAP + Playwright + Maestro) | 4h | High |

**Total estimated effort:** ~29h. Tasks are listed in strict execution order; downstream tasks depend on earlier ones.

---

## KEY DESIGN NOTES (for reviewer)

- **MODULE-12 V3 is the single source of truth for SP rates.** This module NEVER hardcodes multipliers or caps — it always reads `categories.sp_earning_multiplier` / `sp_spending_cap_percent` via `calculateCategorySP` (MODULE-12 V3 export). That function is REUSED verbatim; EDU-003 does not re-implement the math.
- **Migration numbers 000018–000020** reserve the next free block (000001–000010 MODULE-04/05/12 V3, 000011–000014 MODULE-03 V3; a small gap is intentional for potential deferred migrations in earlier tracks).
- **Content editor is section-based, not rich text** (per spec §9) — no HTML, no XSS surface. Title + body + image URL + display_order + section_type + is_published are the only writable fields.
- **One published row per `section_type`** enforced by `UNIQUE (section_type) WHERE is_published = true` partial unique index. Replacing published content is a two-step "unpublish + publish" (or a transactional swap via RPC) to respect the constraint.
- **Contextual prompts are strict "1-time" per user** — tracked via `user_profiles.education_prompts_seen JSONB` (e.g. `["seller_first_listing", "buyer_first_purchase"]`). After 3 dismissals of the onboarding, prompts suppress permanently.
- **Bonus badge rule: strict `sp_earning_multiplier > 1.10`** (matches MODULE-12 V3 Rule for buyer-facing bonus display; `= 1.10` is the baseline, not a bonus).
- **Analytics are append-only** — no updates/deletes. Admin dashboard queries aggregate server-side; no PII in `event_data` beyond category IDs and price magnitudes.
- **Onboarding content is versioned via publish/draft**; the mobile carousel reads only `is_published = true` rows ordered by `display_order`, so an admin content rollback is instant (no app release).
- **Example SP values are computed on read**, never stored — that way admin changes to category rates automatically refresh examples without a re-save.

---

## V1 OVERVIEW

MODULE-18 is a **brand-new** module (no prior V2) that ships a configurable trading-education surface built directly on top of MODULE-12 V3's category SP rate system. It delivers:

- A **5-screen skippable onboarding carousel** on first app open.
- A persistent **Help → How Trading Works** screen with accordion sections and an embedded **SP calculator**.
- An **interactive, category-aware SP calculator** placed in 3 locations (Help, Sell tab, Checkout) that computes "earn SP" and "max usable SP" from the same MODULE-12 V3 category rates used at runtime.
- **Bonus-category badges** (⭐ or admin-uploaded custom icon from `categories.bonus_badge_icon_url`) rendered wherever categories appear when `sp_earning_multiplier > 1.10`.
- **Dynamic example scenarios** where admins set `{item_name, price, category_id}` and the app computes the SP math on read.
- **Contextual 1-time prompts** before a user's first listing and first purchase.
- An **admin CMS** (section-based editor + publish/draft + mobile preview + analytics dashboard).
- **Engagement analytics** (onboarding completion, section expansion, calculator usage).

This module does NOT change MODULE-09 V2 (SP balance math), MODULE-12 V3 (category rates are read-only here), or MODULE-03 V2 (Settings shell is merely extended with a "Help" entry).

---

## CRITICAL V1 RULES FOR EDUCATION MODULE

### Rule 1: SP Math Is Delegated to MODULE-12 V3
- `calculateSP(itemPrice, categoryId, mode)` inside this module MUST internally call `categoryService.calculateCategorySP(categoryId, itemPrice)` (MODULE-12 V3 export) and then shape the result into the calculator's return type.
- Never hardcode `1.10`, `70`, or any rate/cap value. If a category is inactive or missing, return `null` and the calculator renders "Select a category".
- Rounding: `earn_sp = Math.round(price × multiplier)`, `max_use_sp = Math.floor(price × cap/100)` — matches MODULE-12 V3 exactly.

### Rule 2: Bonus Badge Rule — Strict `> 1.10`
- A category shows the bonus badge iff `sp_earning_multiplier > 1.10` (strict greater-than). `= 1.10` is the baseline, not a bonus.
- `BonusCategoryBadge` renders `categories.bonus_badge_icon_url` when present; otherwise the ⭐ emoji. Never fetch provider-side icons from external URLs — always use the MODULE-12 V3 Supabase Storage public URL.

### Rule 3: Published Content Is Append-Only From the User's Perspective
- `is_published = true` rows are visible to all users; `is_published = false` rows are admin-only.
- Exactly one published row per `section_type` — enforced by the partial unique index. Admin publish flow MUST unpublish the previous row in the same transaction via RPC `publish_section(id UUID)`.

### Rule 4: Onboarding Is Shown Exactly Once
- `shouldShowOnboarding(userId)` returns `true` iff `user_profiles.onboarding_completed_at IS NULL AND user_profiles.onboarding_skipped_at IS NULL`.
- On completion OR skip, set the corresponding timestamp. Never reset these from client code.
- Analytics event `onboarding_start` fires once per user regardless of path.

### Rule 5: Contextual Prompts Are Strict 1-Time
- A prompt is shown iff its key is NOT in `user_profiles.education_prompts_seen JSONB` array. On dismiss OR "Got it" OR "Learn more", append the key; never remove.
- If the user dismissed the onboarding with Skip AND has dismissed 3 contextual prompts, suppress all further prompts permanently (set `education_prompts_suppressed_at`).

### Rule 6: Admin Writes Require `user_roles.role = 'admin'`
- Every admin-facing RPC (`publish_section`, `unpublish_section`, `update_section`, `create_example`, `delete_example`) is `SECURITY DEFINER` and checks `user_roles` up-front. Non-admin calls throw `UnauthorizedError`.
- All RLS policies reuse the existing MODULE-01 `user_roles` table — no new role table.

### Rule 7: Content Validation Is Server + Client
- `title`: 3–100 chars. `body`: 10–2000 chars. `image_url`: ≤ 500 chars, must be a Supabase Storage public URL or `null` (no arbitrary external URLs — prevents XSS / tracking pixels).
- `section_type` ∈ `{'general','sp_definition','sp_earning','sp_spending','safety','example'}`. Body is rendered as **plain text with newline preservation** — no markdown, no HTML.

### Rule 8: Examples Store Price + Category, Never Calculated Values
- `education_examples` stores `{item_name, item_price, category_id, display_order, is_published}` only. SP values (`earn_sp`, `max_use_sp`, `cash_paid`, `fee`, `is_bonus`) are computed on every read via `calculateExampleSP(price, categoryId)`.
- When MODULE-12 V3 admin changes a category's SP rates, examples automatically reflect the new math without any re-save.

### Rule 9: Analytics Is Append-Only + No PII
- `education_analytics` accepts INSERT only; the RLS policy blocks UPDATE/DELETE for all clients (admins too — audit-grade).
- `event_data JSONB` may contain `{ section_type, category_id, item_price_bucket }` where `item_price_bucket ∈ {'<10','10-50','50-100','>100'}` — NEVER the exact price (privacy).
- `user_id` is nullable on the DB side (to allow anonymous onboarding-start events) but MUST be populated once authenticated.

### Rule 10: Accessibility
- Onboarding carousel supports swipe AND keyboard nav (Tab / arrow keys on web; Voice Control on mobile).
- Accordion sections announce "expanded" / "collapsed" via `accessibilityState`.
- Calculator inputs have labels ("Item price, currency"; "Category, dropdown"); result updates announce via `accessibilityLiveRegion='polite'`.
- Contextual prompts trap focus, close on Esc (web) / swipe-down (mobile), return focus to trigger.
- Screen readers read bonus badge as "Bonus category, earns extra Swap Points".

### Rule 11: Caching
- Published sections cached client-side for **5 minutes** (React Query `staleTime: 5 * 60_000`).
- Admin publish invalidates `['education-sections']` and broadcasts a Supabase Realtime notification on channel `education:content` so other open admin tabs refresh.
- Category SP rates (for the calculator dropdown) cached for **60 seconds** on mobile, invalidated by the admin Realtime broadcast on `education:categories`.

### Rule 12: Placement Constraints
- Sell tab calculator AUTO-FILLS the category from the in-progress listing. User CAN override.
- Checkout calculator AUTO-FILLS from the item; user cannot override (spending cap must match the item's actual category).
- Help-section calculator defaults to "Select a category" — user MUST pick one.

---

## AGENT TEMPLATE

```typescript
/*
YOU ARE AN AI AGENT IMPLEMENTING MODULE-18 TRADING EDUCATION V1.

CONTEXT:
- Kids P2P Marketplace. React Native (Expo) mobile app + Next.js admin portal
  (admin-portal/) + Supabase backend.
- MODULE-12 V3 is the SOURCE OF TRUTH for category SP rates. You MUST call
  categoryService.calculateCategorySP(categoryId, price) — never re-implement.
- MODULE-09 V2 owns SP balance + fee percentages. You only READ the 10% fee
  constant (or the current configured value) to display in the calculator.
- MODULE-03 V2 provides the Settings shell — add one entry: "Help → How
  Trading Works". Do NOT refactor Settings.
- Source of truth: POC1/ai-code-generator/modules/docx/TRADING-EDUCATION-REQUIREMENTS.md v1.0.

YOUR INSTRUCTIONS:
1. Read the entire module before generating any code.
2. Produce a short plan (4-8 steps) and list any missing dependencies.
3. Implement tasks in the order EDU-001 … EDU-010.
4. For each task: generate files at the exact filepath given; run type-check
   and unit tests; do NOT commit.
5. Migration file numbering (reserve this block for MODULE-18 V1):
     20260420000018_create_education_sections.sql
     20260420000019_create_education_examples.sql
     20260420000020_create_education_analytics_and_seed.sql
     20260420000021_education_publish_rpcs.sql
   (Apply strictly in that order. Earlier numbers reserved for V3 modules.)
6. NEVER hardcode SP multipliers or spending caps in app code.
7. NEVER store calculated SP values — always compute on read.
8. Stop and report to the user before running `supabase db push` on
   staging/prod or seeding content to production.

VERIFICATION STEPS (print results after each task):
- TypeScript type-check: `npm run type-check` (both admin-portal + mobile).
- Lint: `npm run lint`.
- Unit tests: `npm test -- --testPathPattern=education|spCalculator|onboarding`.
- Playwright / Maestro: see EDU-010.

ERROR HANDLING:
- Inactive / missing category in calculator: return null; UI renders "Select a category".
- Title/body length violation: throw ContentValidationError with field + reason.
- Non-admin publish attempt: throw UnauthorizedError.
- Duplicate published section_type: throw DuplicatePublishedSectionError.
- Analytics write failure: log + swallow — NEVER block UX.

==================================================
NEXT TASK: EDU-001 (Schema — Sections, Examples, Analytics, Seed, Publish RPCs)
==================================================
*/
```

---

## TASK EDU-001: Schema Migrations — Sections, Examples, Analytics + Seed + Publish RPCs

**Duration:** 3 hours
**Priority:** Critical (foundational — blocks all other tasks)
**Dependencies:** MODULE-01 (`user_roles`, `user_profiles`), MODULE-12 V3 (`categories`)

### Description

Create the three content tables (`education_sections`, `education_examples`, `education_analytics`) with RLS, partial unique index for single-published-per-type, the `publish_section` / `unpublish_section` SECURITY DEFINER RPCs, 2 new columns on `user_profiles` (`onboarding_completed_at`, `onboarding_skipped_at`, `education_prompts_seen`, `education_prompts_suppressed_at`), and the initial seed content (4 sections + 3 example scenarios).

### Scope

**In scope:**
- 4 Supabase migrations (`20260420000018`–`20260420000021`) in strict order.
- All CHECK constraints, RLS policies, partial unique indexes, triggers, comments.
- Seed content for the 4 core sections (`sp_definition`, `sp_earning`, `sp_spending`, `safety`) and 3 examples.
- `user_profiles` additions for onboarding + prompt tracking.

**Out of scope:**
- Analytics materialized views (deferred — raw queries for MVP).
- Seeding `education_examples.category_id` values (admin links via CMS after launch).
- Pre-aggregated analytics tables (deferred).

### Files to Create

| File | Purpose |
|---|---|
| `supabase/migrations/20260420000018_create_education_sections.sql` | `education_sections` table + RLS + partial unique index + trigger |
| `supabase/migrations/20260420000019_create_education_examples.sql` | `education_examples` table + RLS + indexes + trigger |
| `supabase/migrations/20260420000020_create_education_analytics_and_seed.sql` | `education_analytics` table + RLS (INSERT-only) + `user_profiles` columns + seed content |
| `supabase/migrations/20260420000021_education_publish_rpcs.sql` | `publish_section(id UUID)` + `unpublish_section(id UUID)` SECURITY DEFINER RPCs |

### Acceptance Criteria

- [ ] Four migration files exist at the exact paths above.
- [ ] `education_sections` has `id, title, body, image_url, display_order, section_type, is_published, published_at, published_by, created_at, updated_at` with CHECKs (`LENGTH(title) BETWEEN 3 AND 100`, `LENGTH(body) BETWEEN 10 AND 2000`, `LENGTH(image_url) <= 500`, `section_type IN (…)`).
- [ ] Partial unique index `uq_education_sections_one_published_per_type` on `(section_type) WHERE is_published = true`.
- [ ] RLS: "Anyone can view published sections" (FOR SELECT `USING (is_published = true)`) + "Admin can manage all sections" (FOR ALL via `user_roles`).
- [ ] Trigger `education_sections_updated_at` sets `updated_at = now()` on UPDATE.
- [ ] `education_examples` has `id, item_name, item_price, category_id, display_order, is_published, created_at, updated_at` with `item_price > 0 AND <= 10000`; same RLS model as sections; same updated-at trigger.
- [ ] `education_analytics` has `id, user_id (nullable), event_type, event_data jsonb, created_at`; RLS allows INSERT by authenticated users, SELECT by admin only, NO UPDATE/DELETE policies (effectively blocked).
- [ ] `user_profiles` gains columns `onboarding_completed_at TIMESTAMPTZ`, `onboarding_skipped_at TIMESTAMPTZ`, `education_prompts_seen JSONB DEFAULT '[]'::jsonb`, `education_prompts_suppressed_at TIMESTAMPTZ`.
- [ ] Indexes: `idx_education_sections_published (display_order) WHERE is_published = true`, `idx_education_sections_type (section_type, is_published)`, `idx_education_examples_published (display_order) WHERE is_published = true`, `idx_education_analytics_event_type (event_type, created_at DESC)`, `idx_education_analytics_user (user_id, created_at DESC)`.
- [ ] Seed: 4 published sections (sp_definition, sp_earning, sp_spending, safety) + 3 draft examples (category_id = NULL; admin links later).
- [ ] RPCs `publish_section(id)` + `unpublish_section(id)` are `SECURITY DEFINER`, check `user_roles.role = 'admin'`, and `publish_section` unpublishes the previous row of the same `section_type` atomically.
- [ ] All migrations idempotent (`IF NOT EXISTS`, `CREATE OR REPLACE`, `ON CONFLICT DO NOTHING` for seed).
- [ ] Commented verification queries at the bottom of each file.

### AI Prompt for Cursor

````text
TASK: Generate 4 Supabase migrations for MODULE-18 V1.

CONTEXT:
- `user_profiles`, `user_roles`, and (from MODULE-12 V3) `categories` exist.
- Migration numbers 000001..000014 are reserved for prior modules.
  Use 000018..000021 exclusively.

FILE 1: 20260420000018_create_education_sections.sql
- CREATE TABLE public.education_sections (…) with CHECKs per spec.
- Partial unique index:
    CREATE UNIQUE INDEX uq_education_sections_one_published_per_type
      ON public.education_sections (section_type)
      WHERE is_published = true;
- RLS + 2 policies.
- CREATE FUNCTION + trigger for updated_at.
- 2 indexes (published order, type).

FILE 2: 20260420000019_create_education_examples.sql
- CREATE TABLE public.education_examples (…) with price CHECK.
- RLS + 2 policies.
- Reuse update_education_sections_updated_at() trigger function.
- 1 index on (display_order) WHERE is_published = true.

FILE 3: 20260420000020_create_education_analytics_and_seed.sql
- CREATE TABLE public.education_analytics (…).
- RLS: INSERT policy (authenticated), SELECT policy (admin). NO update/delete.
- ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS onboarding_skipped_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS education_prompts_seen JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS education_prompts_suppressed_at TIMESTAMPTZ;
- 2 analytics indexes.
- Seed: INSERT 4 sections (sp_definition / sp_earning / sp_spending / safety) as is_published=true.
  Use verbatim copy from TRADING-EDUCATION-REQUIREMENTS.md §Seed.
- Seed: INSERT 3 examples (LEGO Set $20, Kids Book $10, Toy Car $15) with category_id = NULL.

FILE 4: 20260420000021_education_publish_rpcs.sql
- CREATE OR REPLACE FUNCTION publish_section(section_id UUID)
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
    DECLARE v_type TEXT; BEGIN
      IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id=auth.uid() AND role='admin')
        THEN RAISE EXCEPTION 'UnauthorizedError'; END IF;
      SELECT section_type INTO v_type FROM education_sections WHERE id=section_id;
      UPDATE education_sections SET is_published=false
        WHERE section_type = v_type AND is_published=true AND id <> section_id;
      UPDATE education_sections
         SET is_published=true, published_at=now(), published_by=auth.uid()
       WHERE id=section_id;
    END; $$;
- CREATE OR REPLACE FUNCTION unpublish_section(section_id UUID) … (admin check + flip flag).
- REVOKE ALL … FROM public; GRANT EXECUTE … TO authenticated.

OUTPUT 4 FILES, each starting with `--- FILE: <path> ---`.

VERIFICATION QUERIES at bottom of each file (commented):
- File 1: SELECT COUNT(*) FROM pg_indexes WHERE indexname='uq_education_sections_one_published_per_type';
- File 2: SELECT COUNT(*) FROM information_schema.tables WHERE table_name='education_examples';
- File 3: SELECT COUNT(*) FROM education_sections WHERE is_published=true; -- expect 4
- File 4: SELECT proname, prosecdef FROM pg_proc WHERE proname IN ('publish_section','unpublish_section');
````

---

## TASK EDU-002: Shared Types & Error Classes

**Duration:** 1 hour
**Priority:** High
**Dependencies:** EDU-001

### Description

Define the shared TypeScript types (`EducationSection`, `SectionType`, `EducationExample`, `SPCalculation`, `BonusCategory`, `EducationAnalyticsEvent`) and typed error classes (`ContentValidationError`, `UnauthorizedError`, `DuplicatePublishedSectionError`) used across mobile + admin-portal.

### Scope

**In scope:**
- 1 type file + 1 errors file in mobile; 1 type file + 1 errors file in admin-portal (duplicated minimal to keep packages independent).
- Strict TS — no `any`.
- Stable `code` strings on error classes.

**Out of scope:**
- Runtime validation libraries (zod, yup).
- Service implementations.

### Files

| Path | Purpose |
|---|---|
| `p2p-kids-marketplace/src/types/education.ts` | Mobile-side types: `EducationSection`, `SectionType`, `EducationExample`, `SPCalculation`, `BonusCategory`, `EducationAnalyticsEvent` |
| `p2p-kids-marketplace/src/types/education-errors.ts` | `ContentValidationError`, `AnalyticsWriteError` (warn-only) |
| `admin-portal/src/types/education.ts` | Admin-side mirror + admin-only fields (`published_by`, draft metadata) |
| `admin-portal/src/types/education-errors.ts` | `ContentValidationError`, `UnauthorizedError`, `DuplicatePublishedSectionError` |

### Acceptance Criteria

- [ ] `SectionType = 'general' \| 'sp_definition' \| 'sp_earning' \| 'sp_spending' \| 'safety' \| 'example'` — matches DB CHECK exactly.
- [ ] `SPCalculation` is a discriminated union on `mode: 'sell' \| 'buy'` where sell yields `earn_sp` and buy yields `max_sp_usable, sp_spending_cap_percent, cash_paid, fee, total_cost`.
- [ ] `BonusCategory` is a subset of MODULE-12 V3's `Category` (no admin fields).
- [ ] `EducationAnalyticsEvent.event_type` union matches the DB CHECK list verbatim.
- [ ] Every error class extends `Error` and carries `code: string` (e.g. `'CONTENT_VALIDATION'`).
- [ ] Mobile type file does NOT import from `admin-portal`.

---

## TASK EDU-003: Backend Services — Content + Example + SP Calculator + Analytics

**Duration:** 4 hours
**Priority:** Critical
**Dependencies:** EDU-001, EDU-002, MODULE-12 V3 (`calculateCategorySP`, `getBonusCategories`)

### Description

Implement four service modules (mobile-side for user reads, admin-portal-side for CMS writes): `ContentService` (get sections, publish/unpublish via RPC), `ExampleService` (CRUD + on-read SP calculation delegation), `SPCalculatorService` (thin wrapper over MODULE-12 V3's `calculateCategorySP` shaped to `SPCalculation`), and `AnalyticsService` (append-only event logging + admin aggregations).

### Scope

**In scope:**
- 4 mobile services (read-only + analytics write) + 3 admin services (CMS writes + analytics reads).
- Delegation to MODULE-12 V3 for all SP math.
- React Query-friendly signatures (Promise-returning, stable keys).
- Analytics: fire-and-forget on mobile; `console.warn` on write failure.

**Out of scope:**
- UI components (EDU-004 – EDU-009).
- Realtime subscription wiring for CMS invalidation (EDU-008 hook).
- Pre-aggregated analytics (raw SQL for MVP).

### Files to Create / Modify

| Path | Action | Key Exports |
|---|---|---|
| `p2p-kids-marketplace/src/services/educationContentService.ts` | NEW | `getPublishedSections`, `getSectionByType` |
| `p2p-kids-marketplace/src/services/educationExampleService.ts` | NEW | `getPublishedExamples`, `calculateExampleSP` |
| `p2p-kids-marketplace/src/services/spCalculatorService.ts` | NEW | `calculateSP`, `getBonusCategories` (delegates to MODULE-12 V3) |
| `p2p-kids-marketplace/src/services/educationAnalyticsService.ts` | NEW | `trackEducationEvent`, `shouldShowOnboarding`, `markOnboardingComplete`, `markOnboardingSkipped`, `markPromptSeen`, `shouldShowPrompt` |
| `admin-portal/src/services/educationContentService.ts` | NEW | `getAllSections` (drafts+published), `updateSection`, `publishSection` (RPC), `unpublishSection` (RPC), `createSection` |
| `admin-portal/src/services/educationExampleService.ts` | NEW | `getAllExamples`, `createExample`, `updateExample`, `deleteExample` |
| `admin-portal/src/services/educationAnalyticsService.ts` | NEW | `getEducationAnalytics(dateRange)` — aggregations |

### Acceptance Criteria

- [ ] `getPublishedSections()` SELECTs `is_published=true` ordered by `display_order`; cached 5 min.
- [ ] `getSectionByType(type)` returns the single published row or `null`.
- [ ] `calculateExampleSP(price, categoryId)` internally calls MODULE-12 V3 `categoryService.calculateCategorySP(categoryId, price)` and shapes to `{ earn_sp, max_use_sp, cash_paid, fee, is_bonus }`. If category is missing/inactive → returns `null`.
- [ ] `calculateSP(itemPrice, categoryId, mode, spToUse?)` returns `SPCalculation` discriminated union; delegates 100% of math to MODULE-12 V3.
- [ ] `getBonusCategories()` delegates to MODULE-12 V3 `spConfigService.getBonusCategories()` — does NOT re-query.
- [ ] `trackEducationEvent(eventType, eventData?)` is fire-and-forget (returns `Promise<void>` that never rejects); logs via `console.warn` on failure.
- [ ] `shouldShowOnboarding(userId)` returns `true` iff both `onboarding_completed_at IS NULL` and `onboarding_skipped_at IS NULL`.
- [ ] `markPromptSeen(userId, key)` appends `key` to `user_profiles.education_prompts_seen` (JSONB array; idempotent).
- [ ] Admin `publishSection(id)` calls RPC `publish_section(id)` — never does the transition client-side.
- [ ] Admin `createExample({item_name, item_price, category_id?})` starts with `is_published = false`; `deleteExample(id)` refuses when `is_published = true`.
- [ ] `getEducationAnalytics({startDate, endDate})` returns `{ onboarding: { started, completed, skipped, completionRate }, help: { views, sectionExpansionsByType }, calculator: { uses, uniqueUsers, priceBucketHistogram } }`.
- [ ] All services use strict TS; no `any`; no ad-hoc `as` casts.
- [ ] Unit tests cover happy paths + null-category + admin-only-enforcement.

### AI Prompt for Cursor

````text
TASK: Implement MODULE-18 V1 services.

HARD RULES:
- SPCalculatorService is a THIN shim over MODULE-12 V3's calculateCategorySP.
  Do NOT re-implement rate / cap math.
- trackEducationEvent NEVER throws. Wrap the Supabase insert in try/catch
  and console.warn on failure. Analytics must never break UX.
- Admin publishSection MUST invoke RPC publish_section(id); never manipulate
  is_published from the client.
- createExample MUST start with is_published=false.
- deleteExample MUST refuse when is_published=true (throw ContentValidationError
  with code='EXAMPLE_IS_PUBLISHED').
- All admin analytics aggregations execute in SQL (raw queries). Do not
  paginate or in-memory-sum large result sets.

Test files listed in EDU-010.
````

---

## TASK EDU-004: Mobile UI — OnboardingCarousel + First-Run Gating

**Duration:** 3 hours
**Priority:** High
**Dependencies:** EDU-003

### Description

Build the 5-screen swipeable onboarding carousel that shows on first app open, with progress dots, skip/next buttons, analytics hooks, and completion tracking via `markOnboardingComplete` / `markOnboardingSkipped`.

### Scope

**In scope:**
- 1 new screen + 1 new carousel component + 5 screen-data entries.
- First-run gate wired into app root (after auth, before main tabs).
- Asset directory for onboarding illustrations.

**Out of scope:**
- Localizing content (English only for MVP).
- Animated transitions beyond the default swipe.
- Tests (EDU-010).

### Files to Create / Modify

| Path | Action | Purpose |
|---|---|---|
| `p2p-kids-marketplace/src/screens/onboarding/OnboardingScreen.tsx` | NEW | Root screen — carousel container + gating |
| `p2p-kids-marketplace/src/components/onboarding/OnboardingCarousel.tsx` | NEW | Swipeable 5-screen carousel with progress dots |
| `p2p-kids-marketplace/src/components/onboarding/OnboardingScreenCard.tsx` | NEW | Single screen (illustration + title + body) |
| `p2p-kids-marketplace/src/data/onboarding-screens.ts` | NEW | 5 static screen definitions (welcome + 3 SP + safety) |
| `p2p-kids-marketplace/src/assets/onboarding/` | NEW | 5 illustration PNGs (placeholder until design delivers) |
| `p2p-kids-marketplace/src/navigation/RootNavigator.tsx` | MODIFY | Check `shouldShowOnboarding(user.id)` → route to `OnboardingScreen` before `MainTabs` |

### Acceptance Criteria

- [ ] Carousel renders 5 screens; swipe left/right navigates; keyboard arrow keys work on web.
- [ ] Progress dots update (filled = current; ghosted = others).
- [ ] "Skip" button on every screen calls `markOnboardingSkipped` → navigates to `MainTabs`.
- [ ] Final screen shows "Get Started" → calls `markOnboardingComplete` → navigates to `MainTabs`.
- [ ] `onboarding_start` analytics event fires on first render (guarded against duplicates per mount).
- [ ] `onboarding_complete` or `onboarding_skip` fires on exit path; `section_expand` events NOT fired here (those live in HelpScreen).
- [ ] Subsequent app opens: `shouldShowOnboarding(user.id)` returns `false` → carousel bypassed.
- [ ] Full a11y: each screen announces `"Onboarding, step N of 5, <title>"`; skip button has `accessibilityLabel="Skip onboarding"`.
- [ ] No reference to MODULE-12 V3 category data (onboarding content is static and admin-controlled via sections — screens 2–4 pull body from `getSectionByType('sp_definition'|'sp_earning'|'sp_spending')`; screen 5 from `'safety'`).

---

## TASK EDU-005: Mobile UI — HelpScreen (Accordion + Embedded Calculator + Bonus Categories)

**Duration:** 3 hours
**Priority:** High
**Dependencies:** EDU-003, EDU-004

### Description

Build the always-accessible `HelpScreen` (Settings → Help → How Trading Works): accordion of published sections (SP Definition expanded by default), embedded `SPCalculator`, and "Bonus Categories" list showing every category with `sp_earning_multiplier > 1.10`.

### Scope

**In scope:**
- 1 new screen + 2 new components (`EducationSectionAccordion`, `BonusCategoriesList`).
- Pull-to-refresh.
- Deep link via `?section=sp_spending` query param.
- Settings menu entry wired into MODULE-03 V2 Settings.

**Out of scope:**
- SP Calculator itself (EDU-006) — this screen composes it.
- Contextual prompts (EDU-007).
- Tests (EDU-010).

### Files to Create / Modify

| Path | Action | Purpose |
|---|---|---|
| `p2p-kids-marketplace/src/screens/help/HelpScreen.tsx` | NEW | Route `/settings/help`; accordion + calculator + bonus list |
| `p2p-kids-marketplace/src/components/education/EducationSectionAccordion.tsx` | NEW | Expand/collapse animated section |
| `p2p-kids-marketplace/src/components/education/BonusCategoriesList.tsx` | NEW | List of bonus categories with badges + earn-rate text |
| `p2p-kids-marketplace/src/screens/settings/SettingsScreen.tsx` | MODIFY | Add "Help → How Trading Works" row |

### Acceptance Criteria

- [ ] Route reachable from Settings. Initial load < 1 s with sections cached.
- [ ] Accordion: `sp_definition` expanded by default; other sections collapsed; tap header toggles; `accessibilityState={expanded}` announced.
- [ ] Each section renders body as plain text with newline preservation (no markdown).
- [ ] Calculator embedded below sections; defaults to "Select a category".
- [ ] "Bonus Categories" section renders under the calculator: list of categories where `sp_earning_multiplier > 1.10` sorted DESC by multiplier; each row shows icon + name + `BonusCategoryBadge` + formatted earn-rate (e.g. `"Earn 1.30× SP"`).
- [ ] Analytics events: `help_view` on mount (once per mount); `section_expand` on each expand (event_data: `{ section_type }`).
- [ ] Deep-link: opening `/settings/help?section=sp_spending` auto-expands that section and scrolls into view.
- [ ] Pull-to-refresh invalidates `['education-sections']` + `['bonus-categories']` query keys.

---

## TASK EDU-006: Mobile UI — SPCalculator widget + BonusCategoryBadge (3 placements)

**Duration:** 3 hours
**Priority:** High
**Dependencies:** EDU-003

### Description

Build the reusable `SPCalculator` widget (category dropdown + price input + live-computed sell/buy panels) and the `BonusCategoryBadge` component, then mount the calculator in 3 placements: Help (free-form), Sell tab (auto-fills from listing, user-overridable), Checkout (locked to item's category).

### Scope

**In scope:**
- 2 new components + 3 placement integrations.
- Client-side math ONLY via `spCalculatorService.calculateSP` (which delegates to MODULE-12 V3).
- Analytics event `calculator_use` with price bucket + category + mode.
- A11y on inputs + live region on results.

**Out of scope:**
- Slider UX for SP spend amount in checkout (MODULE-06 V2 already owns that; calculator only displays max).
- Tests (EDU-010).

### Files to Create / Modify

| Path | Action | Purpose |
|---|---|---|
| `p2p-kids-marketplace/src/components/education/SPCalculator.tsx` | NEW | Full widget: category dropdown + price input + sell/buy result panels |
| `p2p-kids-marketplace/src/components/education/BonusCategoryBadge.tsx` | NEW | ⭐ or custom `bonus_badge_icon_url` per category |
| `p2p-kids-marketplace/src/screens/help/HelpScreen.tsx` | MODIFY | Mount unlocked calculator |
| `p2p-kids-marketplace/src/screens/ItemCreateScreen.tsx` | MODIFY | Mount auto-filled calculator (auto-fills category from current draft; user can override) |
| `p2p-kids-marketplace/src/screens/checkout/CheckoutScreen.tsx` | MODIFY | Mount locked calculator (category pinned to item.category_id) |

### Acceptance Criteria

- [ ] `SPCalculator` props: `{ mode: 'free' | 'auto' | 'locked'; initialCategoryId?: string; initialPrice?: number }`.
  - `free`: dropdown empty until user picks.
  - `auto`: dropdown pre-filled, editable.
  - `locked`: dropdown disabled, selection pinned.
- [ ] On category change OR price change, widget calls `calculateSP(price, categoryId, 'sell')` AND `calculateSP(price, categoryId, 'buy')` and renders both panels simultaneously.
- [ ] Result updates within 100 ms of input (client-side math; no network).
- [ ] Bonus badge renders next to the `earn_sp` value when `is_bonus_category === true`.
- [ ] Price input accepts 0–10000 with 2 decimals; min/max enforced client-side.
- [ ] When no category selected, panels render placeholder "Select a category to see your SP".
- [ ] `calculator_use` analytics fires debounced 1 s after the last edit with `{ category_id, price_bucket, mode }` — never the exact price.
- [ ] `BonusCategoryBadge` uses `categories.bonus_badge_icon_url` if present (via `expo-image` with fallback to ⭐ emoji on error).
- [ ] A11y: price input `accessibilityLabel="Item price, currency"`; category dropdown `accessibilityLabel="Category"`; results container `accessibilityLiveRegion="polite"`.

---

## TASK EDU-007: Mobile UI — Contextual Prompts (First Listing + First Purchase)

**Duration:** 2 hours
**Priority:** Medium
**Dependencies:** EDU-003, EDU-006

### Description

Add 1-time contextual prompt modals that open before the user's first listing creation (`'seller_first_listing'`) and first purchase (`'buyer_first_purchase'`), with "Got it" and "Learn more" actions (the latter deep-links to `HelpScreen`). Dismissal is permanent per key, and 3 dismissals disable all future prompts.

### Scope

**In scope:**
- 2 new modal components + 1 shared base modal.
- Gating logic: `shouldShowPrompt(userId, key)` + `markPromptSeen(userId, key)`.
- Wiring into `ItemCreateScreen` (before publish flow AFTER phone verification from MODULE-03 V3) and `CheckoutScreen` (before initiate AFTER phone verification).

**Out of scope:**
- Push notification reminders (post-MVP).
- Personalized content (buyer vs seller segmentation beyond the 2 prompt types).
- Tests (EDU-010).

### Files to Create / Modify

| Path | Action | Purpose |
|---|---|---|
| `p2p-kids-marketplace/src/components/education/ContextualPromptModal.tsx` | NEW | Shared modal shell (title + body + 2 CTAs) |
| `p2p-kids-marketplace/src/components/education/SellerFirstListingPrompt.tsx` | NEW | Wraps shell with seller-specific copy |
| `p2p-kids-marketplace/src/components/education/BuyerFirstPurchasePrompt.tsx` | NEW | Wraps shell with buyer-specific copy |
| `p2p-kids-marketplace/src/screens/ItemCreateScreen.tsx` | MODIFY | Before publish (and AFTER phone gate): if `shouldShowPrompt('seller_first_listing')` → show modal; proceed after dismissal |
| `p2p-kids-marketplace/src/screens/checkout/CheckoutScreen.tsx` | MODIFY | Before initiate (and AFTER phone gate): same pattern with `'buyer_first_purchase'` |

### Acceptance Criteria

- [ ] Each prompt shown at most once per user (enforced by `markPromptSeen` on any exit).
- [ ] "Learn more" navigates to `/settings/help` with appropriate `?section=` deep link and counts as a `markPromptSeen` (permanent).
- [ ] If `education_prompts_suppressed_at IS NOT NULL`, no prompts are shown regardless of `education_prompts_seen`.
- [ ] Suppression activates automatically when user has `onboarding_skipped_at IS NOT NULL` AND `education_prompts_seen` contains ≥ 3 keys — computed in `shouldShowPrompt` before any DB write.
- [ ] Content body references category bonus concepts ("Some categories earn bonus SP ⭐") without naming specific multipliers (those are dynamic per MODULE-12 V3).
- [ ] Analytics: `contextual_prompt_view` fires on mount; `contextual_prompt_dismiss` fires on "Got it" / swipe / Esc.
- [ ] Modal is DISMISSIBLE (swipe down / Esc / "Got it" / "Learn more" all valid) — UNLIKE the phone-verification modal from MODULE-03 V3 which is non-dismissible in these contexts.
- [ ] Ordering with phone gate from MODULE-03 V3: phone verification runs FIRST (non-dismissible); contextual prompt runs AFTER (dismissible).

---

## TASK EDU-008: Admin Portal — EducationContentPage (Sections + Examples + Preview)

**Duration:** 4 hours
**Priority:** High
**Dependencies:** EDU-003

### Description

Build the admin-facing `EducationContentPage` (route `/admin/education`) with 3 tabs (Sections, Examples, Analytics), section edit form with Save Draft / Preview / Publish actions, example form with a category dropdown pulling from MODULE-12 V3, and a mobile-preview modal.

### Scope

**In scope:**
- 1 new admin page + 6 components (SectionTable, SectionForm, ExampleTable, ExampleForm, MobilePreview, PublishConfirmation).
- React Query hooks for all content CRUD.
- Navigation entry under admin **Content Management → Education**.

**Out of scope:**
- Analytics dashboard tab (EDU-009).
- Realtime content sync across admin tabs (optional; added only if the polling default is insufficient).
- Tests (EDU-010).

### Files to Create / Modify

| Path | Action | Purpose |
|---|---|---|
| `admin-portal/src/pages/EducationContentPage.tsx` | NEW | Route `/admin/education`; tabbed shell |
| `admin-portal/src/components/education/SectionTable.tsx` | NEW | List sections w/ status + actions |
| `admin-portal/src/components/education/SectionForm.tsx` | NEW | Modal: title/body/image/type/order + Save/Preview/Publish |
| `admin-portal/src/components/education/ExampleTable.tsx` | NEW | List examples w/ computed earn/use SP columns |
| `admin-portal/src/components/education/ExampleForm.tsx` | NEW | Modal: item_name/price/category_id/order |
| `admin-portal/src/components/education/MobilePreview.tsx` | NEW | iPhone-shaped preview container |
| `admin-portal/src/components/education/PublishConfirmation.tsx` | NEW | "Publishing will replace the current live section — continue?" |
| `admin-portal/src/hooks/useEducationContent.ts` | NEW | React Query hooks: sections list + mutations |

### Acceptance Criteria

- [ ] Route `/admin/education` registered under admin navigation **Content Management → Education**.
- [ ] Tabs: Sections (N), Examples (M), Analytics (badge with "new" dot when unread metrics updated).
- [ ] `SectionTable` columns: Title, Type, Status (Published / Draft badge), Updated, Actions (Edit / Preview / Publish / Unpublish).
- [ ] `SectionForm`: all fields validated client-side against DB CHECKs (title 3–100, body 10–2000, image_url ≤ 500 chars). Character counter live. Body displayed as plain text only (no rich text).
- [ ] Save Draft → `is_published` unchanged (creates new draft row if `id` is new; updates existing otherwise).
- [ ] Preview → opens `MobilePreview` modal rendering the `HelpScreen` layout using the draft content (does NOT write to DB).
- [ ] Publish → opens `PublishConfirmation` → on confirm calls RPC `publish_section(id)` (which unpublishes the previous row of the same `section_type` atomically); toast "Published".
- [ ] `ExampleTable` columns: Item Name, Price, Category (name from MODULE-12 V3 JOIN), Earn SP (computed), Max Use SP (computed), Status, Actions.
- [ ] `ExampleForm` category dropdown fetches from MODULE-12 V3 `getCategoriesWithCounts(true)` (admin scope).
- [ ] Delete Example disabled when `is_published = true`; tooltip "Unpublish first".
- [ ] All mutations invalidate `['education-sections']` / `['education-examples']` and show toast on success + error.
- [ ] Full a11y on modals (focus trap, Esc closes, focus returns on close).

### AI Prompt for Cursor

````text
TASK: Build EducationContentPage + 6 components + hooks.

HARD RULES:
- Publish MUST call RPC publish_section(id) — never flip is_published directly.
- ExampleForm category dropdown pulls from MODULE-12 V3 getCategoriesWithCounts(true).
- SectionForm body is a plain <textarea> — no markdown, no rich-text editor.
- PublishConfirmation is required for any publish action. Unpublish has its
  own simpler confirm.
- MobilePreview is READ-ONLY — it never writes to DB; it takes form state
  as props and renders a simulated HelpScreen layout.

No tests in this task — they live in EDU-010.
````

---

## TASK EDU-009: Admin Portal — AnalyticsDashboard

**Duration:** 2 hours
**Priority:** Medium
**Dependencies:** EDU-003, EDU-008

### Description

Build the Analytics tab inside `EducationContentPage`: onboarding funnel (started / completed / skipped / completion rate), help section metrics (views + avg time + top expanded sections), and calculator usage (uses + unique users + price-bucket histogram). Date range picker 7 / 30 / 90 days (default 30).

### Scope

**In scope:**
- 1 new dashboard component + 4 chart/metric cards.
- Date range default 30 days; shared with MODULE-12 V3 `DateRangePicker` if present (reuse over re-implement).

**Out of scope:**
- Drill-down to per-user analytics.
- Export CSV (optional post-MVP if requested).
- Tests (EDU-010).

### Files to Create

| Path | Purpose |
|---|---|
| `admin-portal/src/components/education/AnalyticsDashboard.tsx` | Container + date range + 3 metric sections |
| `admin-portal/src/components/education/OnboardingFunnelCard.tsx` | Started → Completed / Skipped funnel |
| `admin-portal/src/components/education/HelpMetricsCard.tsx` | Total views + avg time + top sections bar chart |
| `admin-portal/src/components/education/CalculatorUsageCard.tsx` | Uses + unique users + price-bucket histogram |
| `admin-portal/src/hooks/useEducationAnalytics.ts` | Date-ranged fetch |

### Acceptance Criteria

- [ ] Date range defaults to last 30 days; 7 / 30 / 90 options.
- [ ] Onboarding funnel shows counts + completion rate with color-coded warn if `completionRate < 50%`.
- [ ] Help metrics card shows top 5 expanded sections sorted DESC.
- [ ] Calculator usage card shows price bucket histogram (`<10`, `10-50`, `50-100`, `>100`).
- [ ] Empty-state per card: "No data for selected range".
- [ ] Initial load < 2 s on staging data.

---

## TASK EDU-010: Tests (Jest + Component + PgTAP + Playwright + Maestro)

**Duration:** 4 hours
**Priority:** High
**Dependencies:** EDU-003 … EDU-009

### Description

Ship the full test package for MODULE-18: Jest unit tests for all services, component tests for the calculator + onboarding + HelpScreen accordion, PgTAP DB tests for the partial unique index + RPC admin guard + analytics append-only enforcement, Playwright specs for admin CMS flows, and Maestro flows for mobile UX paths.

### Scope

**In scope:**
- 6 Jest suites.
- 1 PgTAP SQL file.
- 3 Playwright specs under `admin-portal/e2e/`.
- 4 Maestro flows under `p2p-kids-marketplace/.maestro/`.
- Coverage target ≥ 85% on all EDU services.

**Out of scope:**
- Visual-regression snapshots.
- Load testing.

### Test Files

| Path | Covers |
|---|---|
| `p2p-kids-marketplace/src/__tests__/services/spCalculatorService.test.ts` | Delegation to MODULE-12 V3; sell/buy shapes; null category |
| `p2p-kids-marketplace/src/__tests__/services/educationContentService.test.ts` | Cache, published filter |
| `p2p-kids-marketplace/src/__tests__/services/educationAnalyticsService.test.ts` | Fire-and-forget (no throw on error); onboarding + prompt state machines |
| `p2p-kids-marketplace/src/__tests__/components/SPCalculator.test.tsx` | Mode prop behavior, bonus badge render, debounced analytics |
| `p2p-kids-marketplace/src/__tests__/components/OnboardingCarousel.test.tsx` | Navigate, skip, complete, analytics firing |
| `p2p-kids-marketplace/src/__tests__/components/EducationSectionAccordion.test.tsx` | Expand/collapse, a11y state |
| `admin-portal/src/__tests__/services/educationContentService.test.ts` | publish via RPC; delete-guard on example |
| `supabase/tests/education.sql` | PgTAP: uq one-published-per-type; publish_section admin guard; analytics UPDATE/DELETE blocked |
| `admin-portal/e2e/education-content-publish.spec.ts` | Playwright: edit → save draft → preview → publish → verify live |
| `admin-portal/e2e/education-example-crud.spec.ts` | Playwright: create example with category → publish → appears in list |
| `admin-portal/e2e/education-analytics.spec.ts` | Playwright: switch date range → metrics update |
| `p2p-kids-marketplace/.maestro/onboarding-flow.yaml` | Maestro: swipe through 5 screens + complete |
| `p2p-kids-marketplace/.maestro/help-flow.yaml` | Maestro: navigate to help + expand section + use calculator |
| `p2p-kids-marketplace/.maestro/contextual-prompts-flow.yaml` | Maestro: first listing + first purchase prompts shown once |
| `p2p-kids-marketplace/.maestro/bonus-category-badge.yaml` | Maestro: bonus categories list renders ⭐ badges |

### Acceptance Criteria

- [ ] All Jest tests pass; coverage ≥ 85% on `spCalculatorService`, `educationContentService`, `educationAnalyticsService`, `educationExampleService`.
- [ ] PgTAP tests pass (`supabase test db`):
  - Inserting a second `is_published=true` row of the same `section_type` → unique-violation.
  - Non-admin calling `publish_section` → exception.
  - UPDATE / DELETE on `education_analytics` by any role → permission denied or no-op with assertion.
- [ ] Playwright flows green on staging (3 flows).
- [ ] Maestro flows green on a staging build (4 flows).
- [ ] Perf spot-check: HelpScreen initial load < 1 s with warm cache.

---

## CROSS-TRACK INTEGRATION NOTES

- **MODULE-12 V3 (Admin Categories — Track 2):** MODULE-18 is a pure CONSUMER of category SP rates and bonus badge icons. It calls `calculateCategorySP` and `getBonusCategories` exclusively. No schema dependencies beyond `categories.id, .name, .icon, .bonus_badge_icon_url, .sp_earning_multiplier, .sp_spending_cap_percent, .is_active`.
- **MODULE-09 V2 (Swap Points):** Fee percentage displayed in the calculator (`cash × fee_rate`) is read from MODULE-09's configuration (single source). If MODULE-09 V2 exposes a constant, import it; if it's DB-driven, SELECT on first calculator mount and cache for 5 min.
- **MODULE-03 V2 / V3 (Auth):** Settings menu entry added under the existing Settings shell. The `PhoneVerificationModal` (MODULE-03 V3) takes precedence over EDU contextual prompts — phone gate runs first (non-dismissible), EDU prompts run after (dismissible).
- **MODULE-04 V3 (Item Listing — Track 2):** Sell-tab calculator mounts inside `ItemCreateScreen` auto-filled from the draft; `SellerFirstListingPrompt` shows before publish (after phone gate). Publish flow itself is owned by MODULE-04 V3 — this module only adds two optional modals in that flow.
- **MODULE-06 V2 (Trade Flow):** Checkout-locked calculator mounts inside `CheckoutScreen`; `BuyerFirstPurchasePrompt` shows before initiate (after phone gate). `max_sp_usable` from the calculator MUST match MODULE-06 V2's own slider cap — both read from MODULE-12 V3 so they naturally align.
- **MODULE-01:** `user_roles.role='admin'` gates all EDU admin RPCs. `user_profiles` gains the 4 new columns per EDU-001.

---

## OUT OF SCOPE (Post-MVP)

- Video tutorials (video hosting + rights complexity).
- Quizzes / gamification / unlockable education badges.
- Trade simulator (mock transaction walkthrough).
- Multi-language / i18n.
- Push notification reminders ("Learn about Swap Points").
- Personalized content segmentation (buyer vs seller track).
- Downloadable PDF guides.
- In-app live chat support.

---

## IMPLEMENTATION CHECKLIST (high-level)

- [ ] EDU-001 — schema migrations (3 tables + seed + publish RPCs + user_profiles columns)
- [ ] EDU-002 — shared types + error classes (mobile + admin)
- [ ] EDU-003 — services (Content / Example / Calculator / Analytics) on mobile + admin
- [ ] EDU-004 — `OnboardingCarousel` + first-run gating
- [ ] EDU-005 — `HelpScreen` accordion + Bonus Categories list + Settings entry
- [ ] EDU-006 — `SPCalculator` + `BonusCategoryBadge` + 3 placements
- [ ] EDU-007 — contextual prompts (seller + buyer) wired into ItemCreate + Checkout
- [ ] EDU-008 — admin `EducationContentPage` + sections + examples + preview
- [ ] EDU-009 — admin `AnalyticsDashboard`
- [ ] EDU-010 — tests (Jest + PgTAP + Playwright + Maestro)
- [ ] Apply migrations on staging; verify seed content visible
- [ ] Link initial 3 seed examples to real categories via admin CMS
- [ ] Deliver 5 onboarding illustrations (design dependency)
- [ ] Manual QA with keyboard + screen reader on Onboarding, Help, Calculator
- [ ] Update `PROMPTS_USAGE_GUIDE.md` with a pointer to this module

---

*Document version: 1.0 | Generated from TRADING-EDUCATION-REQUIREMENTS.md v1.0 | Cross-refs: SYSTEM_REQUIREMENTS_V2.md, BUSINESS_REQUIREMENTS_DOCUMENT_V2.md, POC desgin.md | Next review: after Track 4 implementation*
