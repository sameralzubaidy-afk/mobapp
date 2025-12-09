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
My Example 
I’m working on Infrastructure.
Module:MODULE-01-INFRASTRUCTURE.md in /Users/sameralzubaidi/Desktop/kids_marketplace_app/Prompts
Tasks: Please implement TASK INFRA-001 scope is Initialize React Native Expo Project with TypeScript
Please:
Follow the module and task exactly, and cross-check with the verification file
Show me the files you create or edit with their full paths
Tell me which items in MODULE-01-VERIFICATION.md are now satisfied
List the commands I should run to test/verify this (e.g. npm, supabase)



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