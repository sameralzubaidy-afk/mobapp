# Repo layout, docs folder standard, module prompt files, module map, example prompts, structure trees

Moved verbatim from `.github/agents/Kids P2P App Builder.agent.md` (2026-09-18, Phase D) so the always-loaded agent file stays small. Not auto-loaded: the Builder agent reads it on demand when its pointer says so. Edit in place here; do not copy back into the agent file.

Notes: (1) manual-testing guides now live in `cross-checked-and-consolidated/` (the old `misc/` folder no longer exists); (2) the folder trees in section 10 are illustrative and stale: verify against the real tree.

1. Repo & folder layout (assumed for this agent)
TODO: Confirm actual repo folder tree (DO NOT GUESS)
The folder layout below is provisional. Before implementing ANY change, you MUST:

Verify the real workspace tree exists using MCP tools:

- **Root folders:** Call `list_dir(".")` to confirm `p2p-kids-marketplace/`, `p2p-kids-admin/`, `supabase/`, `docs/`, `docx/`, `Prompts/` all exist.
- **Key files:** Call `file_search` with globs like `"p2p-kids-marketplace/package.json"`, `"supabase/functions/*"`, `"supabase/migrations/*.sql"` to confirm canonical paths.
- **Config check:** Call `file_search("p2p-kids-marketplace/app.json")` and `file_search("p2p-kids-admin/next.config.js")` to confirm app roots.
- **Multi-root:** If a root folder is missing, use `grep_search` on `list_dir` output to detect renamed/moved directories before guessing.
If any canonical root differs, update the “Canonical app roots” list in this agent FIRST.
If there are multiple candidate roots (e.g., multiple Expo apps), STOP and ask which is canonical.

Treat the VS Code / GitHub workspace as:

Root: kids_marketplace_app/
p2p-kids-marketplace/ – Expo React Native app (iOS + Android)
supabase/ – Supabase configuration, SQL migrations, Edge Functions (Deno/TypeScript)
p2p-kids-admin/ – Next.js admin portal (runs on http://localhost:3001)
docx/ – core product/architecture specs
Prompts/ – all AI module prompt and verification files
Inside docx/ you have:

Documentation Folder Standard (MANDATORY — confirmed against actual repo contents)
docx/ holds the canonical product/business/architecture specs as markdown (*.md) — BRD, system requirements, solution architecture, trade flow, payouts, etc. (see the Requirements Gate table). Despite the folder name, it is NOT a Word-file folder.
docs/ holds engineering/testing/operational docs — manual test cases, module implementation summaries, the Flow Registry (docs/flow-registry.md), environment/CI notes, store-submission checklists, etc.
You MUST NOT create duplicate copies of the same spec in both folders. When in doubt which folder a new doc belongs in, ask.
Manual-testing guides (e.g., `MODULE-*.md`) are canonical in the `cross-checked-and-consolidated/` folder — the test automation (`test-automation/trade-flow-v2/manifest.json`, `RUNBOOK.md`, `run-tradeflow-suite.mjs`) reads them from `cross-checked-and-consolidated/`, and `docs/flow-registry.md` points there. NEVER create or maintain a second copy of a manual-testing guide at the workspace root.
Before editing any manual-testing guide, run a TC-ID diff to detect duplicate or lost test cases: `grep -nE "^### .*TC-[A-Za-z0-9-]+" "cross-checked-and-consolidated/<guide>.md"` (and on ANY other copy of the same guide), then confirm exactly ONE canonical copy exists. If you find two diverged copies, merge them into `cross-checked-and-consolidated/` first (preserve every TC; re-letter colliding IDs rather than dropping either) and mark the other copy DEPRECATED — never edit both. When you edit a group's section body (re-wording steps / expected results), update that group's index/summary table in the SAME pass — they drift independently (2026-08-31: the TradeFlowV2 T-group body was synced to the numeric SP-input UI, but the group index rows still read "toggle switch" until caught).
Guide Expected-Results Must Be Verified Against Shipped Source (MANDATORY — 2026-09-11, FIX-Task-16v2)
A guide's expected results, labels and numbers are CLAIMS ABOUT THE SHIPPED APP — never carry them forward from the previous guide's wording. Before re-wording any expected result, prove each claim from the code that owns it: `grep` the screen/service for the literal string the user actually sees (`Combined Offer`, `Safety & Platform Fee`), read the live value/seed for any number (`admin_config`, not the guide), and treat admin-portal field labels as DERIVED unless you see a hardcoded label (`min_listing_price` renders as "Min Listing Price" via key title-casing — grep the derivation, not just a literal label). Then apply the Copy-Consistency Class Sweep to the GUIDE itself: grep the whole guide for the OLD string before replacing it, because other surfaces can legitimately still ship that wording (trade-timeline fee rows hardcode "Platform Fee:", and `TradeListScreen` ships "📦 Bundle Offer · N items" while checkout ships "📦 Combined Offer") — never blanket-replace a string just because one screen changed. Verify each edit landed with a targeted `grep` per intended string, and re-read any block whose edit spans a blank line: a replacement that swallows the blank line silently joins `**Objective:**` and `**Steps:**` into one Markdown paragraph. Evidence: FIX-Task-16v2 — the K/N/S-group drift (stale "free tier / 5%" seller-fee premise, "Transaction Fee" on Item Detail, "Minimum Listing Price", "Bundle Offer" vs "Combined Offer") had survived ~3 QA rounds because each docs pass copied the previous guide instead of the rendered screen.
File Path Normalization (MANDATORY)
Filenames MUST NOT include leading/trailing spaces.
The canonical doc `docx/Solution Architecture & Implementation Plan.md` is correctly named (no leading space) — the historical leading-space workaround is no longer needed and must not be re-added.
If you detect ANY file whose name has a leading/trailing space, STOP and ask Samer to rename it (do not implement features against a "fragile" path).
Never “guess” the path. Always verify the exact filename in the workspace first.
Core product & architecture docs
docx/SYSTEM_REQUIREMENTS_V2.md
docx/BUSINESS_REQUIREMENTS_DOCUMENT_V2.md
docx/Solution Architecture & Implementation Plan.md
These are the source of truth for:

Feature set (Free vs Kids Club+)
Swap Points (SP) rules (earn/spend, 3-day pending, 90-day grace, 50% redemption cap, etc.)
Revenue model (subscription + buyer fee + seller fee, etc.)
Architecture decisions: React Native, Supabase Postgres, Edge Functions, Stripe, Twilio, CPSC API, etc.

Module prompt files (implementation + verification)
All module prompt files live under Prompts/: Note: Folder name is case-sensitive. Use Prompts/ exactly as it exists in the repo. Do not create prompts/ or PROMPTS/.

Prompts/00-START-HERE.md

Prompts/MASTER-IMPLEMENTATION-PLAN.md

Prompts/MODULE-01-INFRASTRUCTURE.md

Prompts/MODULE-01-VERIFICATION.md

Prompts/MODULE-02-AUTHENTICATION.md

Prompts/MODULE-02-VERIFICATION.md

Prompts/MODULE-03-AUTH-V2.md

Prompts/MODULE-03-NODE-MANAGEMENT.md

Prompts/MODULE-03-Node Management VERIFICATION.md

Prompts/MODULE-03-VERIFICATION-V2.md

Prompts/MODULE-04-ITEM-LISTING-V2.md

Prompts/MODULE-04-VERIFICATION-V2.md

Prompts/MODULE-05-DISCOVERY-V2.md

Prompts/MODULE-05-VERIFICATION-V2.md

Prompts/MODULE-06-TRADE-FLOW-V2.md

Prompts/MODULE-06-VERIFICATION-V2.md

Prompts/MODULE-07-MESSAGING.md

Prompts/MODULE-07-VERIFICATION.md

Prompts/MODULE-08-BADGES-V2.md

Prompts/MODULE-08-REVIEWS-RATINGS.md

Prompts/MODULE-09-SUBSCRIPTIONS-REMAINING.md

Prompts/MODULE-09-SUBSCRIPTIONS-VERIFICATION.md

Prompts/MODULE-10-SWAP-POINTS-CORE-REMAINING.md

Prompts/MODULE-10-SWAP-POINTS-CORE-VERIFICATION.md

Prompts/MODULE-11-REFACTORING-V2-ALIGNMENT.md

Prompts/MODULE-11-REFACTORING-VERIFICATION.md

Prompts/MODULE-12-REFERRALS-V2-IMPLEMENTATION.md

Prompts/MODULE-12-REFERRALS-VERIFICATION.md

Prompts/MODULE-13-GAMIFICATION-IMPLEMENTATION.md

Prompts/MODULE-13-GAMIFICATION-VERIFICATION.md

Prompts/MODULE-14-NOTIFICATIONS-V2.md

Prompts/MODULE-14-VERIFICATION-V2.md

Prompts/MODULE-15-TESTING-QA.md

Prompts/MODULE-15-VERIFICATION.md

Prompts/MODULE-16-DEPLOYMENT.md

Prompts/MODULE-16-VERIFICATION.md

Rule: For “V2” modules, treat V2 as canonical and earlier versions as historical context. Files prefixed with DEPRECATED- are for reference only and contain no active implementation work.


5. Module-by-module intent (high-level)
When asked to implement or change something, map it to these modules:

Module 01 – Infrastructure

Project scaffolding, Expo app setup, Supabase project structure, environment config, basic navigation/layout.
Module 02 & 03 – Authentication & Node Management

User registration, login, phone verification, JWT handling.
Node / ZIP code mapping, waitlist logic, gating of access by node status.
Module 04 – Item Listing

Listing creation, editing, expiration, payment preference (Cash Only / Accept SP / Donate), AI moderation hooks.
Module 05 – Discovery

Swipe feed, search filters, favorites, subscriber-priority listing exposure.
Module 06 – Trade Flow

End-to-end purchase flow, SP slider for subscribers, transaction states, settlement, fees.
Module 07 – Messaging

Secure in-app chat with moderation (no contact info sharing, basic profanity filters, report flow).
Module 08 – Badges, Achievements, Reviews

Ratings, reviews, donation badges, trust badges.
Module 09 – Subscriptions (Stripe)

Stripe integration, Kids Club+ tier gating, webhook handling, and grace periods.
Module 10 – Swap Points Core

SP ledger implementation, 50% cap, pending/release transition logic.
Module 11 – App Refactoring & Alignment

Performance audit, navigation hardening, and state management consistency (v2 alignment).
Module 12 – Referrals V2

Secure referral code generation and subscriber-only incentive management.
Module 13 – Gamification (Lifetime SP)

Lifetime statistics, milestones, and advanced point-based achievements.
Module 14 – Notifications

Push, in-app, email notifications for key events (transactions, SP changes, subscription status, safety alerts).
Module 15 – Testing & QA

Testing strategy, test data, automation, end-to-end flows.
Module 16 – Deployment

CI/CD, environment promotion, release process, monitoring.
Always use the relevant module's VERIFICATION file as your definition of done.


8. Example prompts the user might ask you (usage examples)
Here are some concrete ways the user can use this agent in GitHub Copilot Chat:

Infrastructure / initial setup
“Using docx/MODULE-01-INFRASTRUCTURE.md and its verification file, scaffold the Expo React Native app in p2p-kids-marketplace/ and set up basic navigation + Supabase client configuration. Show me which files you create and the exact commands to run.”

Auth & node access
“Implement phone-based signup and login flows based on MODULE-02-AUTHENTICATION.md and MODULE-03-AUTH-V2.md, including Twilio verification and node/waitlist logic. Update both Supabase Edge Functions and the RN screens, and confirm against the Module 02/03 verification checklists.”

Listings & SP-aware payment preference
“From MODULE-04-ITEM-LISTING-V2.md and the BRD’s Listing Management + Swap Points sections, implement the listing creation screen and Edge Function. Support Cash Only / Accept SP / Donate options for subscribers, and Cash Only only for free users. Show how you enforce these rules server-side.”

Trade flow with SP slider
“Using MODULE-06-TRADE-FLOW-V2.md and the System Requirements FR-TX and FR-SP sections, implement the checkout Edge Function and RN UI with an SP slider capped at 50% of item price. Ensure subscribers still pay the cash platform fee and that SP pending logic is correct.”

Swap Points wallet
“Based on MODULE-09-POINTS-GAMIFICATION-V2.md and the SP schema in the Solution Architecture doc, implement the SP wallet Edge Functions plus a mobile wallet screen showing available vs pending SP, lifetime stats, and countdown to release. Include tests where feasible.”

Subscriptions & grace period
“Using MODULE-11-SUBSCRIPTIONS-V2.md and the BRD’s subscription model, implement Stripe subscription handling, free trial, and 90-day grace period. Wire up the correct SP freezing/unfreezing behavior in the wallet layer.”

Notifications
“Implement the core notification system from MODULE-14-NOTIFICATIONS-V2.md: push notifications for new messages, sales, SP release, and subscription events. Use the verification checklist to confirm coverage and show me where to plug in FCM keys.”

Testing & QA
“From MODULE-15-TESTING-QA.md, propose a Jest-based test structure for RN + Edge Functions and add a sample test suite for the trade flow + SP release, mapping directly to the verification checklist.”

Duplicate Identifier Gate — full rule moved to Section 13 "Duplicate Identifier Prevention" (single canonical source); Tier 0 typecheck (HP-2a) is the backstop check, not the first line of defense.

10. Code organization best practices
10.1 Mobile app structure
p2p-kids-marketplace/
├── src/
│   ├── api/              # Supabase client, Edge Function calls
│   ├── components/       # Reusable UI components
│   ├── screens/          # Screen components (one per route)
│   ├── navigation/       # React Navigation config
│   ├── types/            # Shared TypeScript types
│   ├── hooks/            # Custom React hooks (useAuth, useSP, etc.)
│   ├── utils/            # Pure utility functions (formatters, validators)
│   ├── constants/        # Config, feature flags, enums
│   └── contexts/         # React contexts (AuthContext, SPContext)
10.2 Supabase structure
supabase/
├── migrations/           # SQL migrations (versioned, sequential)
├── functions/            # Edge Functions (Deno/TypeScript)
│   ├── _shared/          # Shared utilities, types, validators
│   ├── auth/             # Auth endpoints
│   ├── listings/         # Listing CRUD
│   ├── transactions/     # Transaction flow
│   ├── sp/               # Swap Points operations
│   ├── subscriptions/    # Stripe webhooks, subscription logic
│   └── admin/            # Admin operations
└── seed.sql              # Test data for local development
