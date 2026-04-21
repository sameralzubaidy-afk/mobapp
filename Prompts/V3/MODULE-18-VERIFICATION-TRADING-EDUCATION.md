# VERIFICATION — MODULE 18 TRADING EDUCATION V1

**Pairs with:** `MODULE-18-TRADING-EDUCATION.md` v1.0
**Version:** 1.0
**Last Updated:** April 21, 2026
**Traceability Source:** `POC1/ai-code-generator/modules/docx/TRADING-EDUCATION-REQUIREMENTS.md` v1.0

This document is the acceptance gate for MODULE-18. Every section below MUST pass before the module is considered shipped. Each check is either (a) a SQL query with expected result, (b) a shell command expected to exit 0, or (c) a manual observation with clear pass/fail.

---

## 0. Prerequisites

| # | Check | Expected | Command / Query |
|---|---|---|---|
| 0.1 | MODULE-12 V3 shipped (category SP rates + bonus icons) | `calculateCategorySP` exported from MODULE-12 V3 categoryService | `grep -n "export.*calculateCategorySP" p2p-kids-marketplace/src/services/categoryService.ts` |
| 0.2 | MODULE-09 V2 fee constant / config available | `FEE_RATE` or equivalent import path documented | Manual inspection |
| 0.3 | MODULE-03 V2 Settings shell exists | `SettingsScreen.tsx` present | `ls p2p-kids-marketplace/src/screens/settings/SettingsScreen.tsx` |
| 0.4 | MODULE-01 `user_roles`, `user_profiles`, `audit_log` present | all exist | `SELECT to_regclass('public.user_roles'), to_regclass('public.user_profiles');` |

---

## 1. Schema (EDU-001)

### 1.1 Migration files present

```bash
ls -1 supabase/migrations/20260420000018_create_education_sections.sql \
       supabase/migrations/20260420000019_create_education_examples.sql \
       supabase/migrations/20260420000020_create_education_analytics_and_seed.sql \
       supabase/migrations/20260420000021_education_publish_rpcs.sql
```

**Expected:** all 4 paths print; exit 0.

### 1.2 Tables + RLS

```sql
-- Tables exist
SELECT to_regclass('public.education_sections') IS NOT NULL AS sections_ok,
       to_regclass('public.education_examples') IS NOT NULL AS examples_ok,
       to_regclass('public.education_analytics') IS NOT NULL AS analytics_ok;

-- RLS enabled
SELECT relname, relrowsecurity FROM pg_class
WHERE relname IN ('education_sections','education_examples','education_analytics');
-- Expected: all three with relrowsecurity = t
```

### 1.3 One-published-per-type partial unique index

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename='education_sections'
  AND indexname='uq_education_sections_one_published_per_type';
```

**Expected:** 1 row; `indexdef` contains `WHERE (is_published = true)`.

### 1.4 `user_profiles` columns added

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name='user_profiles'
  AND column_name IN (
    'onboarding_completed_at','onboarding_skipped_at',
    'education_prompts_seen','education_prompts_suppressed_at')
ORDER BY column_name;
```

**Expected:** 4 rows.

### 1.5 Seed content present

```sql
SELECT section_type, is_published FROM education_sections
WHERE is_published = true ORDER BY display_order;
-- Expected: 4 rows — sp_definition, sp_earning, sp_spending, safety

SELECT COUNT(*) FROM education_examples;
-- Expected: ≥ 3 (LEGO Set, Kids Book, Toy Car)
```

### 1.6 Publish RPCs

```sql
SELECT proname, prosecdef FROM pg_proc
WHERE proname IN ('publish_section','unpublish_section');
-- Expected: 2 rows, prosecdef = t
```

### 1.7 Analytics append-only

Attempt `UPDATE education_analytics SET event_type='x'` and `DELETE FROM education_analytics` as a non-admin role — both must fail (no RLS policy grants them).

---

## 2. Shared Types (EDU-002)

| # | Check | Expected |
|---|---|---|
| 2.1 | `p2p-kids-marketplace/src/types/education.ts` exists | file present |
| 2.2 | `p2p-kids-marketplace/src/types/education-errors.ts` exists | file present |
| 2.3 | `admin-portal/src/types/education.ts` exists | file present |
| 2.4 | `admin-portal/src/types/education-errors.ts` exists | file present |
| 2.5 | `SectionType` union matches DB CHECK verbatim | union = `'general' \| 'sp_definition' \| 'sp_earning' \| 'sp_spending' \| 'safety' \| 'example'` |
| 2.6 | `npm run type-check` passes (both packages) | exit 0 |
| 2.7 | No `any` in EDU type files | `grep -n " any" src/types/education*.ts` returns no matches |

---

## 3. Backend Services (EDU-003)

### 3.1 Unit tests pass

```bash
npm test -- --testPathPattern=educationContent|educationExample|spCalculator|educationAnalytics
```

**Expected:** green; coverage ≥ 85% on each service.

### 3.2 SP math delegation

`spCalculatorService.calculateSP` internally calls MODULE-12 V3 `calculateCategorySP`. Verify:

```bash
grep -n "calculateCategorySP" p2p-kids-marketplace/src/services/spCalculatorService.ts
```

**Expected:** ≥ 1 reference. No hardcoded `1.10`, `1.30`, `70`, `50`, `80` in the file.

```bash
grep -nE "1\.10|1\.30|\b70\b|\b50\b|\b80\b" p2p-kids-marketplace/src/services/spCalculatorService.ts
```

**Expected:** no rate/cap literals (only imports / variable references).

### 3.3 Analytics fire-and-forget

Simulate Supabase insert failure (mock rejects with error) → `trackEducationEvent` MUST NOT throw; it logs `console.warn`.

### 3.4 Onboarding + prompt state machine

| Setup | `shouldShowOnboarding` | `shouldShowPrompt('seller_first_listing')` |
|---|---|---|
| New user, no flags | `true` | `true` |
| `onboarding_completed_at` set | `false` | `true` |
| `onboarding_skipped_at` set, no seen keys | `false` | `true` |
| `onboarding_skipped_at` set, 3 seen keys | `false` | `false` (suppressed) |
| `education_prompts_suppressed_at` set | `false` | `false` |

### 3.5 Admin publish via RPC

```bash
grep -n "publish_section\|unpublish_section" admin-portal/src/services/educationContentService.ts
```

**Expected:** ≥ 1 reference to `rpc('publish_section'…)`. No direct `UPDATE education_sections SET is_published=true` anywhere.

```bash
grep -rn "is_published: true" admin-portal/src/services/
```

**Expected:** no matches (or only in type definitions, not queries).

### 3.6 Delete-guard on examples

Attempt `deleteExample(id)` with `is_published=true` → throws `ContentValidationError` with `code='EXAMPLE_IS_PUBLISHED'`.

---

## 4. OnboardingCarousel (EDU-004)

### 4.1 Component tests pass

```bash
npm test -- --testPathPattern=OnboardingCarousel
```

**Expected:** green.

### 4.2 Navigation + gating matrix

| Action | Expected end state |
|---|---|
| New user → open app | Onboarding shown; `onboarding_start` event logged |
| Swipe through 5 screens → "Get Started" | `onboarding_completed_at` set; main tabs shown |
| "Skip" on any screen | `onboarding_skipped_at` set; main tabs shown |
| Kill app → reopen (same user) | Onboarding NOT shown |

### 4.3 A11y

Each screen announces `"Onboarding, step N of 5, <title>"`. Skip button has `accessibilityLabel="Skip onboarding"`.

### 4.4 Screens 2–5 pull content from DB

Update section `sp_earning` body via admin CMS → republish → kill app → reopen as new user → screen 3 shows updated body.

---

## 5. HelpScreen (EDU-005)

### 5.1 Component tests pass

```bash
npm test -- --testPathPattern=EducationSectionAccordion
```

### 5.2 Accordion default state

SP Definition expanded; other sections collapsed.

### 5.3 Deep link

Open `/settings/help?section=sp_spending` → SP Spending expanded and scrolled into view.

### 5.4 Bonus Categories list

Categories returned by `getBonusCategories()` render with `BonusCategoryBadge` + formatted earn-rate, sorted DESC by multiplier. No categories with `sp_earning_multiplier = 1.10` appear.

### 5.5 Analytics

- `help_view` event fires once per mount.
- `section_expand` event fires on each accordion expand with `{ section_type }`.

---

## 6. SPCalculator + BonusCategoryBadge (EDU-006)

### 6.1 Component tests pass

```bash
npm test -- --testPathPattern=SPCalculator
```

**Expected:** green; coverage ≥ 85%.

### 6.2 Mode matrix

| Mode | Dropdown behavior | Context |
|---|---|---|
| `free` | empty → user selects | HelpScreen |
| `auto` | pre-filled, editable | Sell tab (`ItemCreateScreen`) |
| `locked` | pre-filled, disabled | Checkout (`CheckoutScreen`) |

### 6.3 Correctness against MODULE-12 V3

Pick Category "Books" (1.30x / 75%) + price `$25`:
- Earn SP = `Math.round(25 × 1.30) = 33` → display "33"
- Max Use SP = `Math.floor(25 × 0.75) = 18` → display "18"
- Bonus badge rendered.

Pick Category "Toys" (1.10x / 70%) + price `$25`:
- Earn SP = `28`, Max Use SP = `17`.
- Bonus badge NOT rendered (not strictly `> 1.10`).

### 6.4 No-category placeholder

Open HelpScreen calculator without selecting a category → results panels read "Select a category to see your SP".

### 6.5 Analytics debounce

Rapidly change price 10 times in < 1 s → exactly 1 `calculator_use` event logged (debounced).

### 6.6 Price input bounds

Input `-5` or `0` → rejected; input `10001` → rejected; input `25.99` → accepted.

### 6.7 `BonusCategoryBadge` fallback

Category with `bonus_badge_icon_url = NULL` → ⭐ emoji rendered. With valid URL → `expo-image` loads it; on load error → falls back to ⭐.

---

## 7. Contextual Prompts (EDU-007)

### 7.1 1-time gating

| Setup | Action | Expected |
|---|---|---|
| Fresh user | Tap "Create Listing" (after phone gate) | `SellerFirstListingPrompt` shown once; `education_prompts_seen` now includes `seller_first_listing` |
| Same user | Tap "Create Listing" again | Prompt NOT shown |
| Fresh user w/ `education_prompts_suppressed_at` set | Tap "Create Listing" | Prompt NOT shown |

### 7.2 Ordering with MODULE-03 V3 phone gate

When both phone gate AND contextual prompt would apply, phone gate shows FIRST (non-dismissible) and contextual prompt shows AFTER (dismissible). Verify by instrumenting the sequence:

```
PhoneVerificationModal open → user verifies → modal closes →
SellerFirstListingPrompt open → user dismisses → publish proceeds.
```

### 7.3 "Learn more" deep link

Tap "Learn more" → navigates to `/settings/help?section=sp_earning` (seller) or `sp_spending` (buyer). Counts as `markPromptSeen` (permanent).

### 7.4 Auto-suppression rule

User has `onboarding_skipped_at` set AND 3 keys in `education_prompts_seen` → `shouldShowPrompt` returns `false` for all remaining keys.

---

## 8. Admin Portal — EducationContentPage (EDU-008)

### 8.1 Route registered

Manual: `/admin/education` accessible from admin nav under **Content Management → Education**.

### 8.2 Tabs

- Sections (N) — count reflects total sections (drafts + published).
- Examples (M) — count reflects total examples.
- Analytics — always visible.

### 8.3 Publish flow

Edit "What are Swap Points?" body → Save Draft → row shows as draft row alongside current published row → Preview → mobile preview renders draft body → Publish → `PublishConfirmation` → confirm → current published row flips to `is_published=false`, new row flips to `true` atomically.

Check DB afterwards:
```sql
SELECT id, is_published FROM education_sections WHERE section_type='sp_definition' ORDER BY is_published DESC;
-- Expected: exactly one row with is_published=true
```

### 8.4 Publish via RPC only

```bash
grep -n "is_published" admin-portal/src/services/educationContentService.ts
```

**Expected:** no direct writes to `is_published`; all transitions go through RPCs.

### 8.5 Example form category dropdown

Options pulled from MODULE-12 V3 `getCategoriesWithCounts(true)` — includes inactive categories so admins can link to any.

### 8.6 Example delete guard

Try to delete a published example → button disabled with tooltip "Unpublish first".

### 8.7 Mobile preview

Preview modal renders:
- Accordion with current draft content
- Embedded calculator (functional, pulling live category data)
- Bonus categories list
All read-only from form state; no DB writes.

---

## 9. Admin Analytics (EDU-009)

### 9.1 Date range

Default = 30 days; switching to 7 / 90 reloads metrics.

### 9.2 Onboarding funnel

Displays: started, completed, skipped, completion rate. Rate color-coded red if `< 50%`.

### 9.3 Top expanded sections

Bar chart sorted DESC; max 5 sections shown.

### 9.4 Calculator histogram

Buckets `<10`, `10-50`, `50-100`, `>100` — totals sum to `uses` metric.

### 9.5 Empty state

With date range where no analytics rows exist → each card shows "No data for selected range".

### 9.6 Perf

Initial load < 2 s on staging.

---

## 10. DB-Level Tests (EDU-010 PgTAP)

```bash
supabase test db --file supabase/tests/education.sql
```

**Expected all assertions pass:**

1. INSERT a second `is_published=true` row for the same `section_type` → unique-violation error.
2. Non-admin calling `publish_section(id)` → exception.
3. UPDATE on `education_analytics` by authenticated user → zero rows affected (no policy grants it).
4. DELETE on `education_analytics` → zero rows affected.
5. `publish_section(new_id)` with existing published row of same type → prior row flipped to `is_published=false` in the same transaction.

---

## 11. E2E (Playwright — EDU-010)

```bash
npx playwright test admin-portal/e2e/education-content-publish.spec.ts
npx playwright test admin-portal/e2e/education-example-crud.spec.ts
npx playwright test admin-portal/e2e/education-analytics.spec.ts
```

**Expected:** all 3 specs green on staging.

---

## 12. E2E (Maestro — EDU-010)

Run on a staging build (iOS + Android):

```bash
maestro test p2p-kids-marketplace/.maestro/onboarding-flow.yaml
maestro test p2p-kids-marketplace/.maestro/help-flow.yaml
maestro test p2p-kids-marketplace/.maestro/contextual-prompts-flow.yaml
maestro test p2p-kids-marketplace/.maestro/bonus-category-badge.yaml
```

**Expected:** all 4 flows pass.

---

## 13. Cross-Module Integration

| # | Check | Expected |
|---|---|---|
| 13.1 | Calculator pulls rates from MODULE-12 V3 | Change `sp_earning_multiplier` via MODULE-12 V3 admin → HelpScreen calculator updates within 60 s (cache TTL) |
| 13.2 | Bonus badge pulls icon from MODULE-12 V3 | Upload a custom `bonus_badge_icon_url` in MODULE-12 V3 → HelpScreen and calculator render custom icon |
| 13.3 | Phone gate precedes EDU prompt | Instrumented trace: `PhoneVerificationModal.onClose` fires BEFORE `SellerFirstListingPrompt.onShow` |
| 13.4 | Settings entry added | `grep -n "How Trading Works" p2p-kids-marketplace/src/screens/settings/SettingsScreen.tsx` returns 1 match |
| 13.5 | ExampleForm uses MODULE-12 V3 category list | `grep -n "getCategoriesWithCounts" admin-portal/src/components/education/ExampleForm.tsx` returns 1 match |
| 13.6 | Fee percentage imported from MODULE-09 V2 | `grep -n "FEE_RATE\|fee_rate" p2p-kids-marketplace/src/components/education/SPCalculator.tsx` returns 1 match |

---

## 14. Security Checklist

- [ ] All admin RPCs (`publish_section`, `unpublish_section`) enforce `user_roles.role='admin'` server-side.
- [ ] `education_analytics` has NO UPDATE/DELETE policies.
- [ ] Body rendered as plain text — no HTML parsing, no markdown, no external link auto-embed.
- [ ] `image_url` restricted to Supabase Storage public URLs (admin-side validation + server-side CHECK via DOMAIN or trigger if enforced).
- [ ] No raw SP multipliers or caps hardcoded anywhere in `src/` outside MODULE-12 V3.
- [ ] Contextual prompt + onboarding flags are server-derived (can't be bypassed via client state).
- [ ] Analytics `event_data` contains no exact prices or free-form user text.

---

## 15. Performance Budgets

| Operation | Target | How to measure |
|---|---|---|
| HelpScreen initial load (warm cache) | < 1 s | Manual stopwatch |
| SPCalculator result update | < 100 ms | `performance.now()` bracket in test |
| Admin publish → mobile refresh | < 5 s (cache TTL) | Manual on staging |
| Admin analytics initial load | < 2 s | Manual on staging |
| Bonus categories query | < 150 ms | EXPLAIN ANALYZE via MODULE-12 V3 index |
| Section expand/collapse animation | < 150 ms | Visual |

---

## 16. Content Readiness

- [ ] 4 core sections published with final copy (marketing-reviewed).
- [ ] 3 seed examples linked to real categories via admin CMS.
- [ ] 5 onboarding illustrations delivered by design.
- [ ] Safety section reviewed by legal / compliance.

---

## 17. Sign-off

- [ ] All sections §1–§16 pass.
- [ ] PR includes screenshots of Onboarding (5 screens), HelpScreen, Calculator, Admin Education tabs, Analytics dashboard.
- [ ] No critical or high-severity Snyk / npm audit findings introduced.
- [ ] Module owner (@sameralzubaidy-afk or delegate) has signed off in the PR.

---

*Verification doc version: 1.0 | Pairs with MODULE-18-TRADING-EDUCATION.md v1.0 | Generated from TRADING-EDUCATION-REQUIREMENTS.md v1.0*
