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


## TASK LISTING-V3-006: BulkListingCreateScreen (new)

I’m working on the  MODULE-04-ITEM-LISTING-V3.md tasks
Module:/Users/sameralzubaidi/Desktop/kids_marketplace_app/Prompts/V3/MODULE-04-ITEM-LISTING-V3.md
Tasks:## TASK LISTING-V3-006: BulkListingCreateScreen (new)

scope is 

New screen for bulk upload → auto-group → batch AI → per-item review → publish-all. Separate from `ItemCreateScreen` per UX Decision 11.

### Scope

**In scope:**
- 1 new screen + 6 new bulk subcomponents under `src/components/bulk/`.
- Bulk state machine (`IDLE → ADDING_PHOTOS → GROUPING → AI_ANALYZING → REVIEWING_ITEMS → PUBLISHING → SUCCESS|PARTIAL|ERROR`).
- Multi-select image picker (≤ 30), drag-between-groups, batch publish orchestration.
- One-draft-per-session persistence via `draft_data.items[]`.


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
5. Follow the module and task exactly, and cross-check with the verification file in MODULE-04-VERIFICATION-V3.md
6. Show me the files you create or edit with their full paths
7. Tell me which items in MODULE-04-VERIFICATION-V3.md are now satisfied (location in /Users/sameralzubaidi/Desktop/kids_marketplace_app/Prompts/V3/MODULE-04-VERIFICATION-V3.md
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