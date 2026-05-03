# EDU-001 Testing Note

## Testing Requirements for TASK EDU-001

**Task Scope:** Schema Migrations Only (Database layer, no UI/services)

### ✅ What Tests ARE Required for EDU-001

1. **Manual SQL Verification** (✅ Provided)
   - Location: `docs/manual_testing/EDU-001-SCHEMA-MIGRATIONS.md`
   - Coverage: 14 test cases covering:
     - Table creation
     - RLS enablement
     - Partial unique index enforcement
     - Profile column additions
     - Seed data verification
     - Publish/unpublish RPC functionality
     - Admin authorization enforcement
     - Analytics append-only verification

### ❌ What Tests are NOT Required for EDU-001

1. **Unit Tests**
   - ❌ No TypeScript code to test (schema only)
   - ✅ Deferred to EDU-003 (Backend Services)

2. **Integration Tests**
   - ❌ No services/APIs to test
   - ✅ Deferred to EDU-010 (Complete Test Package)

3. **Maestro UI Flows**
   - ❌ No UI components exist yet
   - ✅ Deferred to EDU-010 (Complete Test Package)

---

## Testing Strategy by Task

| Task | Unit Tests | Integration Tests | Maestro | Manual SQL |
|------|------------|-------------------|---------|------------|
| **EDU-001** (Schema) | ❌ | ❌ | ❌ | ✅ (14 TCs) |
| **EDU-002** (Types) | ✅ | ❌ | ❌ | ❌ |
| **EDU-003** (Services) | ✅ | ✅ | ❌ | ❌ |
| **EDU-004** (Onboarding UI) | ✅ | ❌ | ✅ | ❌ |
| **EDU-005** (Help Screen) | ✅ | ❌ | ✅ | ❌ |
| **EDU-006** (Calculator Widget) | ✅ | ❌ | ✅ | ❌ |
| **EDU-007** (Prompts) | ✅ | ❌ | ✅ | ❌ |
| **EDU-008** (Admin CMS) | ✅ | ❌ | ❌ | ❌ |
| **EDU-009** (Admin Analytics) | ✅ | ❌ | ❌ | ❌ |
| **EDU-010** (Complete Tests) | ✅ | ✅ | ✅ | ❌ |

---

## Regression Tier for EDU-001

**Change Classification:** DB/Migrations/RLS/Triggers/RPC

**Required Tiers:**
- ⚪ **Tier 0:** N/A (no TypeScript code to lint/typecheck)
- ✅ **Tier 1:** Manual SQL verification (run 14 test cases in EDU-001-SCHEMA-MIGRATIONS.md)
- ✅ **Tier 2:** REQUIRED (DB migrations + RLS + RPC changes)

---

## Sign-Off Criteria for EDU-001

✅ Task EDU-001 is **COMPLETE** when:

1. All 4 migration files applied in Supabase SQL Editor (production)
2. All 14 manual test cases in `EDU-001-SCHEMA-MIGRATIONS.md` PASS
3. Verification queries confirm:
   - Tables exist with RLS enabled
   - Partial unique index enforces one published per section_type
   - Seed data present (4 sections + 3 examples)
   - Publish/unpublish RPCs functional
   - Admin authorization enforced
   - Analytics append-only (UPDATE/DELETE blocked)

---

## When Will Unit/E2E/Maestro Tests Be Added?

**EDU-003 (Backend Services):**
- Unit tests for:
  - `educationContentService.ts`
  - `educationExamplesService.ts`
  - `spCalculatorService.ts`
  - `educationAnalyticsService.ts`

**EDU-010 (Complete Test Package):**
- PgTAP tests for:
  - `publish_section` / `unpublish_section` logic
  - Partial unique index enforcement
  - Analytics RLS append-only
- Maestro flows for:
  - Onboarding carousel (skip vs complete)
  - Help screen accordion + calculator
  - Contextual prompts (first listing/purchase)
  - Admin content editor (publish/unpublish)

---

## Navigation Updates

**Not Applicable for EDU-001**

Navigation changes will be delivered in:
- **EDU-004:** Add route for OnboardingCarousel (shown once on app open)
- **EDU-005:** Add route for HelpScreen (accessible from Settings)

---

**End of Testing Note**
