You don’t need anything fancy, just 3–5 key pieces every time:

Which module + docs

Which task IDs (from the module)

Scope (what to touch / what NOT to touch)

What you want back (code + tests + how to verify)

1. Simple template you can reuse every time

When you open Copilot Chat with your Kids P2P App Builder agent, say something like:

Module: <module file(s) here>
Tasks: <task IDs from the module>
Goal: <what you want it to implement or change>
Repo paths: <where code lives>
Please:

Follow the module + verification file

Show the code changes with file paths

Tell me which verification items are done and how to test

You can literally copy-paste and fill this each time.

2. Concrete examples for you to copy and tweak
A. Example – Infrastructure setup (Module 01)

I’m working on Infrastructure.
Module: docx/MODULE-01-INFRASTRUCTURE.md and docx/MODULE-01-VERIFICATION.md
Tasks: Please implement the first 2–3 tasks in Module 01 (INFRA-001, INFRA-002, etc.) to:

Scaffold the Expo app in p2p-kids-marketplace/

Set up Supabase client config
Repo paths:

App: p2p-kids-marketplace/

Supabase: supabase/

---

## ask for new reqs 
 we need to dooument the requirements for task 2 for Bulk Listing with AI auto-fill and also we need to improve the create one item UX as well. 
  the outcome should be a md file in /Users/sameralzubaidi/Desktop/kids_marketplace_app/docx 
 - start with what is the best for UX based on what compitors offer today for such feature. 
 - ask me questions and ask me to review the functions before creating the file. 
- for each suggestion give me your recommedation
- read this md file for search and filter requiremnets , we need to take these functions into considration as we are enhaceing create new items feature 
/Users/sameralzubaidi/Desktop/kids_marketplace_app/docx/SEARCH-FILTER-REQUIREMENTS.md
-----
My Example 1



## TASK EDU-001: Schema Migrations — Sections, Examples, Analytics + Seed + Publish RPCs

I’m working on the  MODULE-18-TRADING-EDUCATION.md tasks
Module:/Users/sameralzubaidi/Desktop/kids_marketplace_app/Prompts/V3/MODULE-18-TRADING-EDUCATION.md
Tasks: ## TASK EDU-001: Schema Migrations — Sections, Examples, Analytics + Seed + Publish RPCs

scope is 

Create the three content tables (`education_sections`, `education_examples`, `education_analytics`) with RLS, partial unique index for single-published-per-type, the `publish_section` / `unpublish_section` SECURITY DEFINER RPCs, 2 new columns on `user_profiles` (`onboarding_completed_at`, `onboarding_skipped_at`, `education_prompts_seen`, `education_prompts_suppressed_at`), and the initial seed content (4 sections + 3 example scenarios).

### Scope

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


i want you to 

1- Search the codebase for existing implementations using:
   - Feature keywords
   - Table names
   - Function names
   - UI labels (admin buttons, status names, etc.)

   2. Explicitly confirm ONE of the following in your response:
   - ✅ An existing implementation was found and will be reused/extended
   - ❌ No existing implementation exists, new code is required

3. If similar logic exists:
   - You MUST extend or refactor the existing code
   - You MUST NOT create a parallel implementation
4. Forbidden: Re-implementing logic that already exists under a different name
5. Follow the module and task exactly, and cross-check with the verification file in MODULE-18-VERIFICATION-TRADING-EDUCATION.md
6. Show me the files you create or edit with their full paths
MODULE-18-VERIFICATION-TRADING-EDUCATION.md are now satisfied (location in /Users/sameralzubaidi/Desktop/kids_marketplace_app/MODULE-18-VERIFICATION-TRADING-EDUCATION.md
8. always include short answers first
9. Note I do not use supabase locally, always must be supabase prod.
10. if there is a need to run a sql in supabase before testing clearly ask me to do. 
11. create  Unit and E2E tests 
12. Update the navigation file on UI  so i can verify manually
13. provide steps to manaul test format it as test cases create md file for it. 
14. I do not use yarn I use npm so give me all commend lines for npm. 
15. update flow-registry.md if needed so that i keep this file up to date.
16.  I am using ISO and Andriod simlators I do not use phsyical devices please consider this for manaul verfication.
17. Testing Requirements (All Mandatory)

> ⚠️ RULE 1: Tests required regardless of change size. No exceptions.

#### Unit Tests
- Location: `__tests__/`
- One test per function/hook/service
- One render test per row in state matrix (if conditional UI)
- Mock all Supabase and external dependencies
- Run: `npm run test:unit` → must PASS ✅

#### Integration Tests
- Location: `__tests__/integration/` or `e2e/*.integration.test.ts`
- Run against staging Supabase
- Run: `RUN_SUPABASE_E2E=true npm run test:e2e` → must PASS ✅
- List any required SQL separately and wait for confirmation

#### Maestro UI Flow Tests
> ⚠️ RULE 3: Maestro YAML must be delivered in same response as TC markdown.

- Check `.maestro/` for existing flow — update if exists, create if not
- File: `.maestro/{{flow-name}}.yaml`
- Requirements:
  - `testID` locators on all interactive elements (add missing `testID` props to source)
  - `assertVisible` after each major step
  - `waitForAnimationToEnd` for async loading
  - Cover ALL rows in state matrix — one flow block per state
  - Cover happy path + at least one error state
  - Enforce RULE 5 strictness: deterministic preconditions + hard final assertion
  - No skip-based success (conditional blocks cannot be the only validation path)
  - Comment header: `# FLOW: <name> | TASK: {{TASK_ID}} | States covered: <list>`
- Update `maestro-flows-registry.md`
- Run: `npm run test:maestro:ios` AND `npm run test:maestro:android` → both PASS


MODULE-12-VERIFICATION-V2.md

my example 2 - to verify
I want to verify what’s already implemented for MODULE-08-REVIEWS-RATINGS by exeucting the steps in  MODULE-11-VERIFICATION-V2.md in /Users/sameralzubaidi/Desktop/kids_marketplace_app/Prompts/
 My requirements listed in   /Users/sameralzubaidi/Desktop/kids_marketplace_app/Prompts/MODULE-08-REVIEWS-RATINGS.md

Please:

Read the verification checklist in MODULE-08-REVIEWS & RATINGS-VERIFICATION.md
Inspect the current code under:
/Users/sameralzubaidi/Desktop/kids_marketplace_app
make sure you create all needed unit tests and E2E tests. 
Tell me which verification items appear complete, which are partially done, and which are missing
Suggest a small, safe set of next changes to fully satisfy the remaining items in case missing items
start with short and crisp answer



-----
B. Example – Auth V2 signup with trial (Module 03)

I’m working on Auth V2.
Module: docx/MODULE-03-AUTH-V2.md and docx/MODULE-03-VERIFICATION-V2.md
Tasks: Implement AUTH-V2-001 (signup with trial + SP wallet) only.
Goal:

New users should get a 30-day Kids Club+ trial

Create an SP wallet when they sign up

Enrich the user context/session as described in the module
Repo paths:

App screens: p2p-kids-marketplace/src/screens/

Auth services: p2p-kids-marketplace/src/services/auth/

Edge Functions: supabase/functions/auth-signup/ (or the path suggested by the module)

Please:

Follow the module and System Requirements for subscription + SP rules

Show the key code changes with file paths

Map your work to the verification checklist (say which items are ✅)

Give me the steps + commands to test this flow end-to-end in the app

C. Example – Listing creation with SP rules (Module 04)

I’m working on Item Listing V2.
Module: docx/MODULE-04-ITEM-LISTING-V2.md and docx/MODULE-04-VERIFICATION-V2.md
Tasks: Implement the core listing creation flow (CREATE only) from the module.
Goal:

Sellers can create listings in the app

Only subscribers (trial/active) can set Accept SP or Donate; free users are limited to Cash Only

Enforce these rules server-side
Repo paths:

App screen: p2p-kids-marketplace/src/screens/ListingCreateScreen.tsx

Listing service: p2p-kids-marketplace/src/services/listings/

Edge Function: supabase/functions/listings-create/ or as specified by the module

Please:

Use the rules from the BRD + System Requirements + Module 04

Show code changes with paths

Tell me which verification items from MODULE-04-VERIFICATION-V2.md are covered

Highlight any // TODO questions you added where requirements are unclear

D. Example – Running just verification (no new code)

I want to verify what’s already implemented for Auth V2.
Module: docx/MODULE-03-AUTH-V2.md and docx/MODULE-03-VERIFICATION-V2.md

Please:

Read the verification checklist

Inspect the current code under:

p2p-kids-marketplace/src/screens/auth/

p2p-kids-marketplace/src/services/auth/

supabase/functions/auth-*

Tell me which verification items appear complete, which are partially done, and which are missing

Suggest a small, safe set of next changes to fully satisfy the remaining items

E. Example – Small change / bugfix

I’m seeing an issue in the trade flow.
Module: docx/MODULE-06-TRADE-FLOW-V2.md

Problem: right now the SP slider seems to let users apply more than 50% of the item price in SP.

Please:

Use the trade flow + SP rules from System Requirements + Module 06

Find where the SP slider logic and server validation live

App: p2p-kids-marketplace/src/screens/CheckoutScreen.tsx

Edge Function: supabase/functions/transactions-create/ (or current path)

Fix it so SP can never exceed 50% of the item price AND the buyer still pays the cash fee

Show me the changes and how to test them

Note any // TODO if something in the docs is ambiguous"