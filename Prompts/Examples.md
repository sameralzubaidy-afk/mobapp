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


- [ ] you before start any next task


### toubleshooting 
Use Mobile MCP to take a screenshot of the current simulator screen. Or use Use React Native DevTools MCP to check:

Look at what you see and identify any visible error, broken UI, 
or unexpected state.

Context: I tried again and got this error after selected the payment method on the screen. 
Expected: user to complete the flow sucesffully and seller receive the offer 

Then:
1. Identify which file and component is responsible
2. Read that file
3. Fix only the broken part , do the best effort to fix what i have not add new functions unless needed for the fix.
3.1 if you need to push the fix to supabase , use MCP for it. If you face problems ask me to do it manaully. 
4. If you need actions from me , list them for me clearly. 
Logs below from my app simaltor

—
### Make changes to UI
Use Mobile MCP to take a screenshot of the current simulator screen.

Look at what you see and help me to make the following changes on 
this screen users getting after complete offer request. 

Actions: 
1- remove the rate and review line. no need for it. 
2- remove the trade id line 
3- replce done with a button take users to my trade screen. make sure the button style looks like all other buttons in the app 
3.1 if you need to push the fix to supabase , use MCP for it. If you face problems ask me to do it manaully. 
4- restyle the back to home button to look like other button on the app
5- make the join kidsclub button more visiallly important for users 
6- make sure the fees 2$ is not hard coded value , this must come from the admin congiration side 

Then:
1. Identify which file and component is responsible
2. Read that file
3. Fix only the broken part , do the best effort to fix what i have not add new functions unless needed for the fix, 
4. If you need actions from me , list them for me clearly. 

--
My Example 1

### TASKs in MODULE-15.5-prod-readiness.md

I’m working on the implmentiing all the  tasks in MODULE-15.5-prod-readiness.md
Module:/Users/sameralzubaidi/Desktop/kids_marketplace_app/Prompts/V3/MODULE-15.5-prod-readiness.md
Tasks: from  PROD-001 to PROD-013
scope 

PROD-P001	iOS Privacy Descriptions + PrivacyInfo.xcprivacy
PROD-P002	Remove Service Role Key from Admin Portal Browser ✅ DONE
PROD-P003	Global Error Boundary
PROD-P004	Crash Reporting (Sentry)
PROD-P005	COPPA Enforcement (DB-level gate for minors)
Main Tasks

PROD-001	Remove Anon RLS Policies from sp_wallets / sp_ledger
PROD-002	Restrict admin_config RLS
PROD-003	Edge Function Rate Limiting
PROD-004	Node Isolation at RLS Level
PROD-005	Edge Function Stripe Connect Ownership Verification
PROD-006	TypeScript Strictness — Enable noImplicitAny
PROD-007	Fix ESLint Failures
PROD-008	Fix Test Failures
PROD-009	App Store Metadata & Privacy Policy
PROD-010	Consolidate Admin Authentication
PROD-011	Android Data Safety & Google Play Families Policy
PROD-012	Production Environment Configuration & Secret Audit
Scan Task

PROD-013	Full-Stack Production Readiness & Security Scan (Client + Admin)
 
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
5. Follow the module and task exactly, and cross-check with the verification file in MODULE-15.2-Cart-VERIFICATION.md 
6. Show me the files you create or edit with their full paths
MODULE-15.2-Cart-VERIFICATION.mdare now satisfied (location in /Users/sameralzubaidi/Desktop/kids_marketplace_app/MODULE-15.2-Cart-VERIFICATION.md
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
18. do not break any working function 
19. do not hardcode any value, fetch form db where is applicable. 
20. for any DB changes , you have my perimisoon to use supbase CLI to run them. 
21. once you done give me a tabke shows status for each task completion. 

> ⚠️ RULE 1: Tests required regardless of change size. No exceptions.

#### Unit Tests
1- Search the codebase for existing Tests using:
   - Feature keywords
   - Table names
   - Function names
   - UI labels (admin buttons, status names, etc.)
- Location: `__tests__/`
- One test per function/hook/service
- One render test per row in state matrix (if conditional UI)
- Mock all Supabase and external dependencies
- Run: `npm run test:unit` → must PASS ✅

#### Integration Tests
1- Search the codebase for existing Tests using:
   - Feature keywords
   - Table names
   - Function names
   - UI labels (admin buttons, status names, etc.)
- Location: `__tests__/integration/` or `e2e/*.integration.test.ts`
- Run against staging Supabase
- Run: `RUN_SUPABASE_E2E=true npm run test:e2e` → must PASS ✅
- List any required SQL separately and wait for confirmation

#### Maestro UI Flow Tests
1- Search the codebase for existing Tests using:
   - Feature keywords
   - Table names
   - Function names
   - UI labels (admin buttons, status names, etc.)
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


MODULE-15.5-prod-readiness.md

my example 2 - to verify
I want to verify what’s already implemented for MODULE-15.5-prod-readiness.md by exeucting the steps in  
MODULE-15.5-prod-readiness-VERIFICATION.md
2-MODULE-15.5-prod-readiness-VERIFICATION.md in /Users/sameralzubaidi/Desktop/kids_marketplace_app/Prompts/
 My requirements listed in   /Users/sameralzubaidi/Desktop/kids_marketplace_app/Prompts/MODULE-15.5-prod-readiness-VERIFICATION.md

Please:

Read the verification checklist in MODULE-15.5-prod-readiness-VERIFICATION.md3-sales-tax-VERIFICATION.md 
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