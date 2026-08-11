## Parking Lot - Deferred / Optional Tasks test PR

This file is a short living list of tasks we want to keep handy and trigger later. Each entry should include a short title, detailed acceptance criteria, and steps to run locally or in CI.

### TASK: INFRA-EMULATOR-SETUP (parking)

Purpose: Provide a tracked task for setting up iOS and Android SDKs and CI-friendly emulator jobs so we can run emulator-based E2E tests locally and in GitHub Actions.

When to run: Keep this in the parking lot until we're ready to fully automate local toolkit installation or allocate a macOS CI runner dedicated to iOS/Android builds.

Acceptance criteria (what 'done' looks like):
- Local macOS developer can run iOS simulator and Android emulator and run E2E tests (Detox) locally using the provided npm scripts.
- GitHub Actions `emulator-tests` workflow runs successfully on push / workflow_dispatch and completes Detox E2E tests on macOS (iOS) and ubuntu (Android) runners.
- Clear docs exist explaining how to configure and install Xcode, CocoaPods, Android Studio, SDKs, and AVDs.

Steps to run (local):
1. Install Xcode from App Store (macOS). Open Xcode once to accept licenses.
2. Install Xcode Command Line Tools and ensure `xcode-select` points at Xcode:
   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   xcodebuild -version
   xcrun simctl list devices
   ```
3. Install CocoaPods and run `pod install` in `ios/` after running `npx expo prebuild`.
4. Install Android Studio & SDK, create an AVD, ensure ANDROID_SDK_ROOT/ANDROID_HOME env vars are set and `adb` is on PATH.
5. From project root run:
   ```bash
   npm ci --legacy-peer-deps
   npm run e2e:build:ios
   npm run e2e:run:ios
   # AND / OR
   npm run e2e:build:android
   npm run e2e:run:android
   ```

CI notes (GitHub Actions):
- Ensure `EXPO_TOKEN` secret is added in the repository Secrets → Actions (used by ios prebuild step).
- The `emulator-tests.yml` workflow will prebuild and build for both iOS and Android then run Detox E2E tests. If the first run fails, review logs and adjust simulator/AVD names or SDK versions used by the jobs.

Open questions / follow-ups:
- Do we want CI jobs to run on every push to `main` or only via workflow_dispatch/PR gating? (parking until decide)
- Should we run E2E tests as part of the main PR checks or keep them in a separate, optional pipeline due to resource/time cost? (parking)

### NOTE: Temporary Supabase client defensive fix (added)

Purpose: Record a small defensive change made to allow the Expo app to start when Supabase env vars are missing in local development.

Details / rationale:
- File modified: `src/services/supabase/client.ts`
- Change: client now exports a minimal no-op stub when `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` are not set so the app won't crash on startup (previously threw `supabaseUrl is required`).
- Why: This enables frontend development (UI, navigation, E2E skeletons) on machines that don't yet have Supabase configured, and prevents noisy runtime crashes during early infra work.
- Next steps: When ready, remove the stub and rely on real env variables (or guard calls more precisely). Add an in-app dev banner that indicates Supabase is not configured for clarity.

Status: ✅ noted — safe to continue with Android/iOS verification and E2E work.

When ready, we can move this task from the parking lot and iterate on the CI runner or local instructions.

### TASK: SUPABASE-CLIENT-DEV-FALLBACK (cleanup & developer experience)

Purpose: Replace the temporary chainable no-op Supabase client stub with a robust, clearly-documented developer fallback that is safe, testable, and easy to detect during development. This avoids accidental outages or confusion and ensures the app clearly indicates whether it's running against a real Supabase backend.

Acceptance criteria (what 'done' looks like):
- Add a feature-flag / environment variable (e.g., EXPO_DEV_SUPABASE_STUB=true) to explicitly enable the stub in development only.
- Add a non-ambiguous in-app dev banner or toast when the stub is active: "Supabase not configured — running in fallback mode".
- Replace the current ad-hoc chainable stub with a small, tested implementation in `src/services/supabase/devStub.ts` that has unit tests ensuring chainable methods return safe responses and appropriate error codes.
- Update `.env.local.example` and README to document how to provide real `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` and how to disable the stub.
- Ensure `testSupabaseConnection()` in `src/utils/testSupabase.ts` can detect stub mode and logs an explicit message recommending filling in `.env.local`.
- Add an integration test (Jest) ensuring the app boots without throwing in both stub and real env configurations.

Files / places to change:
- `src/services/supabase/client.ts` (wire in feature flag and import devStub)
- `src/services/supabase/devStub.ts` (new file)
- `src/utils/testSupabase.ts` (detect stub and log clear message)
- `.env.local.example` (document new `EXPO_DEV_SUPABASE_STUB` variable)
- `README.md` (developer setup steps)
- `__tests__/supabase-dev-stub.test.ts` (unit tests)

Steps to run locally / verify:
1. Add `EXPO_DEV_SUPABASE_STUB=true` to `.env.local` (or leave blank to use real keys).
2. Start the app and look for the dev banner and console log indicating stub mode.
3. Run unit tests: `npm run test` — verify devStub tests and app-boot integration test pass.
4. With real `EXPO_PUBLIC_SUPABASE_*` keys populated, restart app — banner should not appear, and `testSupabaseConnection()` should attempt a real connection.

Priority: High (improves developer DX and avoids runtime confusion).

Owner: @sameralzubaidy-afk // TODO: assign a team owner in the next sprint

Notes / rationale:
- The temporary stub helped unblock early frontend work and emulator verification — this task makes that fallback explicit and safe to keep in the codebase if desired, or easy to remove once Supabase config is required.

  ## BEFORE GO live ## TASK AUTH-005,6 and 7
 edit profile > zip code not avalaible and trigger the add to wish list. 

  ## BEFORE GO live I must test and fix usering adding inactive zip code and whaT THE UX look like 

  ## BEFORE GO live ## TASK AUTH-008: Forgot Password Flow
I need to do E2E test in stage , locally I could not. 

 ## MODULE-06-TRADE-FLOW-sellerpayouts.md
## TASK PAY-009 - make the required intergration to complete payout method validations.

---

## POST-MVP FEATURE: Bundle Listings (Seller-Created Multi-Item Bundles)

**Status:** Deferred to Post-MVP  
**Priority:** Medium  
**Rationale:** Cart system (MODULE-15.2) implements basic cart functionality for unique items. Bundle listings (seller creates "3 onesies for $25" as a single listing) adds complexity and is not essential for MVP launch.

**Requirements from BRD (SYSTEM_REQUIREMENTS_V2.md Section 8.3):**
- **BR-BUNDLE-001: Bundle Creation**
  - Users can create bundles (multiple items in one listing)
  - Minimum bundle value: $20
  - Maximum 10 items per bundle
  - Each item in bundle must be photographed
  - Bundle discount encouraged (e.g., 3 onesies for $25 instead of $10 each = $30)

- **BR-BUNDLE-002: Bundle Purchasing**
  - Buyer must purchase entire bundle (no splitting)
  - SP usage applies to total bundle price
  - If bundle = $60, max SP = 30 (50% rule applies to total)

**Implementation Scope (when prioritized):**
1. Extend `items` table with `is_bundle` flag and `bundle_items` JSONB field
2. Create bundle listing UI (multi-item photo upload, bundle pricing)
3. Update discovery feed to show bundle indicator
4. Update cart validation to handle bundle listings
5. Update checkout to prevent bundle splitting
6. Add admin controls for bundle moderation

**Why Deferred:**
- MVP focus is core P2P marketplace functionality
- Regular cart + single items covers 80% of use cases
- Bundle UI/UX requires additional design validation
- Can be added post-launch based on seller feedback

**Acceptance Criteria (when implemented):**
- [ ] Sellers can create bundle listings with 2-10 items
- [ ] Each item in bundle has its own photo
- [ ] Bundle price enforces $20 minimum
- [ ] Buyers cannot split bundles at checkout
- [ ] SP 50% rule applies to total bundle price
- [ ] Analytics track bundle creation and purchase rates 

 ## BEFORE GO live i want to show id verfied info on item detials screen so buyeer can know this seller is trusted and verfied. 

  ## BEFORE GO live look at all cron jobs and make sure the system logs all of them when they ran on the detials table 
  
  ## BEFORE GO live make create a martics to show what activiy in the app has what type of notifcations ( web, push or EMIL or SMS) groub by notfication channel to fix or assess what i need for go live what can wait or could be considred as noise. and test notifcation center

  ## BEFORE GO live payout needs FULL end to end testing with real money , check status on app and db BEFORE GO love 

 ## BEFORE GO live  I must test on physical devices the push notifcations reqs includes 
 new trades, unread messeges and what no 

 ## BEFORE GO live push notfication must be tested for all cases in   ## TASK SUB-018: Payment Failure Handling & Automatic Retry 

 ## BEFORE GO live check if the size of the build will be a problem 
 
 ## BEFORE GO live  I must test on physical devices the email notifcations for read messeges. 
 
 ## BEFORE GO live update the how buyer and seller can intracted with and without active trade to limit the chance of doing trades out side the platfrom at same time increase the buyer trust about the seller. 

  ## BEFORE GO live make the search faster and more accessible , today there is a waiting time to load search 1 sec. 

 ## BEFORE GO live  ### TC-004: Prevent self-referral attempts

 ## BEFORE GO live  make sure all emails , in app notfications and push notfications are production ready. 

 ## TASK MSG-010: create admin field for this change Implement Message Expiration (Delete After 30 Days Post-Trade)

MODULE-08-BADGES-V2.md 
 ## BADGES-V2-010: Manual badge creation UI + admin_create_badge RPC (runs retroactive awarding when activated)
 ## BADGES-V2-011: Badge Dashboard (counts per badge, node/global segmentation, CSV export)
 ## BADGES-V2-012: Feature flag badge_feature_enabled (DB migration, server guards, admin toggle)

  #  # # Analytics Configuration for all key actions in the app 
  https://app.amplitude.com/analytics/kidsapp/home user samer.alzubaidy 

   #  # #  After go live

  ## TASK SAFETY-005: Implement Custom AI Agent for Title/Description Review (Supabase Edge Function or External Service)
  ## TASK SAFETY-006: Create AI Moderation Logging (Store All Decisions, Confidence Scores)
  ## TASK SAFETY-007: Implement Fallback to GPT-4 for Low-Confidence Cases

---

## AI ROADMAP BACKLOG (from Product Discussions)

---

### Epic: AI Assisted Listing Experience

#### TASK AI-LISTING-001: Display AI Confidence Levels

**Priority:** Medium

**Purpose:** Display AI confidence for generated fields (category, title, attributes) so users understand how reliable the suggestions are.

**Acceptance Criteria:**
- Show confidence percentage for AI-generated fields
- Hide confidence when below a configurable threshold
- Users can edit all fields regardless of confidence

---

#### TASK AI-LISTING-002: Generate Rich Item Metadata

**Priority:** High

**Purpose:** Generate additional metadata behind the scenes that improves search and recommendations.

**Metadata Examples:**
- Age Range
- Indoor/Outdoor
- Brand
- Material
- Keywords
- Safety Tags

---

#### TASK AI-LISTING-003: Improve AI Listing Quality

**Priority:** High

**Purpose:** Before publishing, review the listing and provide suggestions to improve quality.

**Examples of Suggestions:**
- Add another photo
- Add brand
- Add dimensions
- Improve description
- Specify condition

---

#### TASK AI-LISTING-004: Listing Quality Score

**Priority:** Medium

**Purpose:** Calculate an internal listing quality score.

**Use Cases:**
- Measure listing completeness
- Drive future seller coaching
- Track quality improvements over time

---

### Epic: AI Pricing

#### TASK AI-PRICING-001: Add "Coming Soon" Label for Price Recommendations

**Priority:** High (UX)

**Purpose:** Display a label informing users that AI price recommendations will be available in a future release.

**Copy:**
> AI Price Recommendations — Coming Soon

---

#### TASK AI-PRICING-002: Research AI Price Recommendation Strategy

**Priority:** Future — Not part of MVP

**Purpose:** Investigate approaches for generating price recommendations.

**Research Topics:**
- Marketplace historical pricing
- Depreciation model
- External pricing APIs
- Retail MSRP estimation

---

### Epic: AI Search

#### TASK AI-SEARCH-001: AI Intent Extraction

**Priority:** High

**Purpose:** Allow users to search naturally using conversational language.

**Example Query:**
> Blue bike for a 6 year old under $100

**Expected Behavior:** AI converts natural language into structured filters and executes the search.

---

#### TASK AI-SEARCH-002: Hybrid Search Architecture

**Priority:** High

**Purpose:** Minimize AI costs by routing queries intelligently.

**Architecture:**
- Simple searches → existing search
- Natural language → AI extracts filters → existing Supabase search executes query

---

#### TASK AI-SEARCH-003: Search Result Caching

**Priority:** Medium

**Purpose:** Cache AI-interpreted search queries.

**Benefits:**
- Lower AI cost
- Faster response time
- Better scalability

---

#### TASK AI-SEARCH-004: "Did You Mean?" Search Suggestions

**Priority:** High

**Examples:**
- Elsa Dress → Frozen Dress
- Bike → Bicycle
- Scooter → Ride-on Toy

---

#### TASK AI-SEARCH-005: AI Search Feature Flag

**Priority:** Medium

**Purpose:** Allow AI search to be enabled/disabled without deployment.

---

#### TASK AI-SEARCH-006: Define Search Success Metrics

**Priority:** Medium

**Metrics to Track:**
- Search Success Rate
- Click Through Rate (CTR)
- Search Refinement Rate
- AI Usage Rate

---

### Epic: Seller Success

#### TASK SELLER-001: Seller Insights Dashboard

**Priority:** Future — Post-MVP

**Purpose:** After publishing, AI provides coaching to help sellers improve listings.

**Examples:**
- Add another photo
- Lower price
- Add dimensions
- Improve description

**Approach:** Initially rule-based. Later AI-powered.

---

#### TASK SELLER-002: Seller Performance Recommendations

**Priority:** Future — Post-MVP

**Purpose:** Use marketplace analytics to generate personalized recommendations.

**Triggers:**
- Low views
- Low favorites
- Slow selling items

---

### Epic: Personalization

#### TASK PERSONALIZE-001: Personalized Recommendations

**Priority:** Future — Post-MVP

**Purpose:** Recommend products based on user profile and behavior.

**Signals:**
- Child age
- Browsing history
- Saved items
- Purchase history

---

#### TASK PERSONALIZE-002: Buyer AI Assistant

**Priority:** Future — Post-MVP

**Purpose:** Conversational assistant that helps parents discover items.

**Example:**
> "I'm looking for outdoor toys for a 4-year-old under $50."

---

### Epic: Analytics

#### TASK ANALYTICS-001: AI Adoption Dashboard

**Priority:** Medium

**Metrics to Track:**
- AI generated listings
- AI edits accepted
- AI edits rejected
- Average time to publish
- Listing completion rate

---

#### TASK ANALYTICS-002: Listing Quality Analytics

**Priority:** Medium

**Metrics to Track:**
- Quality score
- Average photos
- Description length
- Time to sale
- Views
- Favorites

---

### Technical Backlog

#### TASK TECH-001: Backend AI Search Service

**Purpose:** Create a backend service that:
- Accepts natural language input
- Calls Google AI
- Returns structured JSON filters

---

#### TASK TECH-002: Search Cache Layer

**Purpose:** Implement caching for AI search interpretation.

**Options:**
- Redis
- Supabase cache
- In-memory cache

---

#### TASK TECH-003: AI Prompt Library

**Purpose:** Centralize prompts used by the application.

**Benefits:**
- Easier maintenance
- Versioning
- A/B testing
- Prompt tuning

---

#### TASK TECH-004: AI Configuration Management

**Purpose:** Store AI configuration in one place.

**Configuration Examples:**
- Model version
- Temperature
- Confidence thresholds
- Prompt versions

---

### Parking Lot (Future Ideas — No Timeline)

- Semantic/vector search
- AI ranking of search results
- Advanced recommendation engine
- AI pricing engine (after marketplace gains data)
- AI-powered seller coaching
- AI buyer concierge
- Marketplace trend analytics

---

base+ model reqs 

Pass It Up — Full Implementation Sequence (Single-File Execution Guide)
Dependency-ordered waves with the complete, ready-to-paste agent prompt embedded under each item. Work top to bottom. Complete each wave (including its DoD checks) before starting the next; items within the same wave can run in parallel.

MoSCoW tags are kept for reference (MUST/SHOULD/COULD) but execution order here is by technical dependency, not MoSCoW.

WAVE 0 — Verify Before Building
Confirms assumptions that R1, R5, R6/R7, and R10 build on. Findings here may change downstream design — do not skip.

B1 — Bundle / Platform Fee Per Checkout (Verification)
TASK TYPE: Verification / Regression Check

WHAT I WANT:
Confirm that the existing bundle/platform fee logic still charges exactly one fixed fee per checkout — not per item — even for multi-item, single-seller bundles. This is documented as already built; I want proof it still holds, especially once R1's tiered buyer-fee engine lands next to it.

CONTEXT:

Affects: Checkout / order summary screen, fee calculation service

App layer: Edge Function (fee calculation) — read-only investigation, no new feature work expected unless a regression is found

YOUR PRE-FLIGHT (do this BEFORE writing any code):

Find and read the spec section that governs this feature — Section 0, B1 "Bundle / platform fee per checkout" in the Pass It Up requirements doc. Tell me: what section you read and what the key rule is.

Search for the existing code that implements this:

Locate the function/RPC/Edge Function that charges the platform fee at checkout

Trace a multi-item, single-seller bundle through it and confirm fee count = 1
Tell me: what you found, and whether R1's upcoming tiered-fee work could break this behavior (e.g., if R1's fee resolution runs per-item instead of per-checkout).

State your Definition of Done:
"This feature is verified when a test checkout with [X items, 1 seller] shows [Y single fee] in the data."
This must come from the spec — not from "it compiles."

THEN verify (do NOT implement new logic unless a gap is found — if you find one, stop and report it to me before fixing).
Report pass/fail against the DoD, with evidence (query result, log line, or test output).
Update the test cases in MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md to add a regression test for this scenario if one doesn't already exist,
and give me the handoff once done.

B2 — Seller Fee (5% Per Trade, on Cash Portion) (Verification)
TASK TYPE: Verification / Regression Check

WHAT I WANT:
Confirm that the existing seller fee logic charges exactly 5% and applies it to the cash portion of the trade only. This matters because R5 (SP redemption) introduces a cash-portion calculation (cash = P - S) that this existing fee logic must consume correctly — I want to confirm B2 is already reading "cash portion" as a distinct value today, not just the full item price, so R5 can plug in cleanly.

CONTEXT:

Affects: Trade completion / seller payout calculation, fee calculation service

App layer: Edge Function (seller fee calculation) — read-only investigation, no new feature work expected unless a regression or a hardcoded "full price" assumption is found

YOUR PRE-FLIGHT (do this BEFORE writing any code):

Find and read the spec section that governs this feature — Section 0, B2 "Seller fee (5% per trade)" in the Pass It Up requirements doc, cross-referenced with R5's "Cash portion and seller fee" scenario. Tell me: what section you read and what the key rule is.

Search for the existing code that implements this:

Locate the function/RPC/Edge Function that computes the 5% seller fee

Confirm whether it currently takes a "cash portion" input or assumes full item price (this is the critical check — if it assumes full price, R5 will need to change its input, not just add SP logic on top)
Tell me: what you found, and specifically whether the fee base is already parameterized correctly for R5 to use.

State your Definition of Done:
"This feature is verified when a trade with price P shows seller fee = 5% x [cash portion, not P] in the data, once SP is involved — or is confirmed as needing a change before R5 lands."
This must come from the spec — not from "it compiles."

THEN verify (do NOT implement new logic unless a gap is found — if you find one, stop and report it to me before fixing, since it may change R5's implementation approach).
Report pass/fail against the DoD, with evidence (query result, log line, or test output).
Update the test cases in MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md to add a regression test for this scenario if one doesn't already exist,
and give me the handoff once done.

B3 — Subscription Management (Trial / Paid / Cancel) (Verification)
TASK TYPE: Verification / Regression Check

WHAT I WANT:
Confirm that the existing subscription management flows (trial start, paid conversion, cancel) work correctly today, and explicitly confirm what they do NOT yet do: enforce SP earn/spend entitlement gating (R6) or block in-app purchase UI in favor of web-first purchase (R7). I want a clear map of "what B3 already handles" vs. "what R6/R7 still need to add," so those two prompts don't duplicate existing subscription-state logic.

CONTEXT:

Affects: Subscription lifecycle screens, subscription status data model

App layer: Mobile UI + Edge Function (subscription state) — read-only investigation, no new feature work expected

YOUR PRE-FLIGHT (do this BEFORE writing any code):

Find and read the spec section that governs this feature — Section 0, B3 "Subscription management" and its accompanying note ("subscription ENTITLEMENT enforcement... and web-first purchase are separate — see R6, R7") in the Pass It Up requirements doc. Tell me: what section you read and what the key rule is.

Search for the existing code that implements this:

Locate the trial/paid/cancel state machine and confirm all three transitions work

Confirm whether any SP earn/spend gating already exists (it shouldn't, per the note) and whether any in-app purchase UI for the subscription already exists (it likely does, and R7 will need to remove it)
Tell me: exactly what state B3 currently manages, and confirm the boundary line where R6 and R7 need to begin.

State your Definition of Done:
"This feature is verified when trial start, paid conversion, and cancel all work correctly today, AND I have a clear, written boundary of what's missing for R6 (entitlement gating) and R7 (web-first + status sync)."
This must come from the spec — not from "it compiles."

THEN verify (do NOT implement R6 or R7 logic here — this is scoping only).
Report pass/fail against the DoD, with evidence (query result, log line, or test output), plus the R6/R7 boundary summary.
Update the test cases in MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md to add a regression test confirming trial/paid/cancel still work, if one doesn't already exist,
and give me the handoff once done.

B4 — Tax Collect Engine (Admin Config Per Node Per Category) (Verification)
TASK TYPE: Verification / Regression Check

WHAT I WANT:
Confirm that the existing tax collect engine correctly resolves rates/exemptions by node and category today, and confirm whether pass-through accounting (tax recorded as collected/payable, not revenue) is already correct — this is the one behavior R10 explicitly needs to add or verify, since the spec separates "engine exists" (B4) from "pass-through accounting behavior" (R10).

CONTEXT:

Affects: Checkout tax calculation, finance/revenue reporting

App layer: Edge Function (tax resolution) — read-only investigation, no new feature work expected unless the pass-through accounting gap is confirmed (in which case, stop and hand off to the R10 prompt rather than fixing here)

YOUR PRE-FLIGHT (do this BEFORE writing any code):

Find and read the spec section that governs this feature — Section 0, B4 "Tax collect engine," cross-referenced with Section 2, R10 "Tax Engine Behaviors" in the Pass It Up requirements doc. Tell me: what section you read and what the key rule is.

Search for the existing code that implements this:

Locate the tax rate/exemption resolution logic and confirm it correctly reads node + category config

Locate where collected tax is recorded in the ledger/accounting layer and confirm whether it's tagged as pass-through liability or incorrectly counted as revenue
Tell me: what you found, specifically flagging whether the revenue-vs-pass-through distinction already exists or is missing (this determines if R10's prompt is additive or corrective).

State your Definition of Done:
"This feature is verified when a checkout in a configured node/category resolves the correct tax rate (including exemptions), AND the accounting tag (pass-through vs. revenue) is confirmed correct or explicitly flagged as a gap for R10."
This must come from the spec — not from "it compiles."

THEN verify (do NOT implement R10 logic here — if the pass-through tagging is missing, stop and report it as a finding for the R10 prompt to fix).
Report pass/fail against the DoD, with evidence (query result, log line, or test output).
Update the test cases in MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md to add a regression test for rate/exemption resolution if one doesn't already exist,
and give me the handoff once done.

WAVE 1 — Foundational Infrastructure
Almost every other requirement reads config from N1 or writes a node tag from N6. Build these before anything that depends on them.

N1 — Configurability (Cross-Cutting)
TASK TYPE: New Implementation

WHAT I WANT:
Build a single admin-tunable configuration layer covering: countdown windows (offer/pickup), grace period length, payout buffer, SP caps/multipliers per category, tax rates per node/category, and buyer/seller fee parameters. Every other requirement (R1-R13) should read from this config rather than hardcoding values.

CONTEXT:

Affects: Admin panel, all fee/timing/SP logic across the app

App layer: Admin UI + DB migration (config tables) + RPC (config read/write) — shared dependency for R1-R13

YOUR PRE-FLIGHT (do this BEFORE writing any code):

Find and read the spec section that governs this feature — Section 5, N1 "Configurability" in the Pass It Up requirements doc. Tell me: what section you read and what the key rules are.

Search for any existing code in the same area:

Any existing admin config tables or feature-flag system

Any hardcoded values in fee, timing, or SP logic that should migrate to config
Tell me: what exists and whether your new code could conflict with it.

State your Definition of Done:
"This feature is complete when a user can [X] and the data shows [Y]"
This must come from the spec — not from "it compiles." (An admin user should be able to change a value and see it take effect without a code deploy.)

THEN implement. After implementing, run your own DoD check and report pass/fail for each item.
Update the test cases in MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md to cover the changes
and give me the handoff once done.

N6 — Node Tagging (Cross-Cutting)
TASK TYPE: New Implementation

WHAT I WANT:
Ensure users, listings, trades, and associated costs are tagged to a node (pilot market) throughout the data model, so KPIs and expansion-gate metrics (per R14 and R9) can be computed per node.

CONTEXT:

Affects: User, listing, trade, and cost/ledger data models

App layer: DB migration (node_id foreign key across tables) + Edge Function (node resolution on write)

YOUR PRE-FLIGHT (do this BEFORE writing any code):

Find and read the spec section that governs this feature — Section 5, N6 "Node tagging" in the Pass It Up requirements doc. Tell me: what section you read and what the key rules are.

Search for any existing code in the same area:

Any existing geographic/market/region tagging on users, listings, or trades
Tell me: what exists and whether your new code could conflict with it.

State your Definition of Done:
"This feature is complete when a user can [X] and the data shows [Y]"
This must come from the spec — not from "it compiles." (Every user, listing, trade, and cost record must resolve to exactly one node.)

THEN implement. After implementing, run your own DoD check and report pass/fail for each item.
Update the test cases in MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md to cover the changes
and give me the handoff once done.

WAVE 2 — Core Trade Lifecycle
R2 is the event source (authorized, captured, cancelled, timed-out) that R1, R3, and R5 all depend on. Build idempotency in as you go, not as a retrofit. Settle R4's dispute-loss config before R3 schedules payouts against the same seller balance. Note: N2's event-type design here must anticipate R15's later trade_extension_reauth event (Wave 7) — see N2's pre-flight below.

R2 — Auth-and-Capture + Countdown State Machine (PLAN MODE FIRST)
TASK TYPE: New Implementation

WHAT I WANT:
Implement a trade hold lifecycle where checkout authorizes (holds) payment without capturing it. After checkout, a configurable 48-hour offer window starts for the seller to accept/decline; if it expires unaccepted, the trade auto-cancels and the hold releases. On acceptance, a configurable 72-hour pickup window starts; if it expires without completion, the trade auto-cancels and the hold releases. When the buyer taps "complete trade" within the pickup window, the payment is captured. Add a guardrail so admins cannot configure offer + pickup windows that together reach or exceed 7 days (Stripe's authorization limit) — decide and implement a clear failure mode (hard block vs. auto-clamp) and document which you chose. Send in-app and push reminders at configurable time thresholds during both windows.

CONTEXT:

Affects: Trade offer flow, seller accept/decline screen, pickup confirmation screen, admin config panel

App layer: Mobile UI + Edge Function (state machine + scheduled jobs) + DB migration (trade state, window timestamps) + RPC + Stripe integration

YOUR PRE-FLIGHT (do this BEFORE writing any code):

Find and read the spec section that governs this feature — Section 1, R2 "Auth-and-Capture + Countdown State Machine" in the Pass It Up requirements doc. Tell me: what section you read and what the key rules are.

Search for any existing code in the same area:

Any existing trade state machine, offer/accept/decline logic, or Stripe auth/capture calls

Any scheduled job or cron handling expirations or reminders
Tell me: what exists and whether your new code could conflict with it.

State your Definition of Done:
"This feature is complete when a user can [X] and the data shows [Y]"
This must come from the spec — not from "it compiles." (Cover authorize-not-capture, both expiry paths, capture-on-completion, the 7-day guardrail, and reminders.) Additionally, design the reminder/notification service so it can be invoked generically (e.g., "request made" / "outcome determined" events), since R15 (Wave 7) will reuse this same service for extension-request notifications rather than building a parallel path.

THEN implement. After implementing, run your own DoD check and report pass/fail for each item.
Update the test cases in MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md to cover the changes
and give me the handoff once done.

N2 — Idempotency & Audit (Cross-Cutting) (PLAN MODE FIRST)
Build this INTO R2 as it's implemented — do not treat as a separate later pass.

TASK TYPE: New Implementation

WHAT I WANT:
Ensure all payment and SP state transitions are idempotent (safe to retry without duplicate effects) and fully logged for audit. This applies to auth/capture, payout release, SP issue/redeem/freeze/release, and fee charges. Design the audit event schema to support multiple distinct event types per trade (e.g., trade_authorization, trade_capture, trade_release), each with its own idempotency key — not a single generic "payment event" bucket — since R15 (Wave 7) will later add a trade_extension_reauth event type that must be distinguishable from the original authorization, not treated as a retry of it.

CONTEXT:

Affects: All payment and SP mutation paths (R1-R6), and later R15's extension re-authorization (Wave 7)

App layer: Edge Function (idempotency key handling) + DB migration (audit log table, idempotency key storage, event-type field)

YOUR PRE-FLIGHT (do this BEFORE writing any code):

Find and read the spec section that governs this feature — Section 5, N2 "Idempotency & audit" in the Pass It Up requirements doc. Tell me: what section you read and what the key rules are.

Search for any existing code in the same area:

Any existing idempotency-key pattern or retry-safety logic on payment paths

Any existing audit/logging table for financial or SP events
Tell me: what exists and whether your new code could conflict with it.

State your Definition of Done:
"This feature is complete when a user can [X] and the data shows [Y]"
This must come from the spec — not from "it compiles." (A retried request must not double-charge, double-issue SP, or double-log; every transition must have an audit trail entry; the schema must support adding a new distinct event type — such as R15's future trade_extension_reauth — without a redesign.)

THEN implement. After implementing, run your own DoD check and report pass/fail for each item.
Update the test cases in MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md to cover the changes
and give me the handoff once done.

R4 — Stripe Connect Charge-Type & Loss-Responsibility (PLAN MODE FIRST)
Can run in parallel with R2, but must be settled before Wave 3's R3.

TASK TYPE: New Implementation

WHAT I WANT:
Configure and document the platform's Stripe Connect charge type as Direct charges, so that on a dispute, Stripe debits the seller (merchant of record) first. Implement dispute cost accounting as: dispute cost = $15 fee + (AOV x (1 - recovery_rate)). Implement handling for the case where a seller's balance is insufficient to cover a dispute (negative-balance and transfer-reversal behavior), following documented Stripe Connect configuration. This requires legal/finance sign-off in parallel — flag any config decision that needs non-engineering approval. Ensure the dispute-cost clock is keyed off the actual trade completion/capture timestamp, not a fixed original-window expectation, so that a trade completed later (e.g., due to a granted R15 extension in Wave 7) is timed correctly with no special-case logic needed.

CONTEXT:

Affects: Stripe Connect account configuration, dispute webhook handler, seller balance ledger, finance reporting

App layer: Edge Function (webhook handler) + DB migration (dispute cost tracking) + Stripe Connect config (non-code, platform settings)

YOUR PRE-FLIGHT (do this BEFORE writing any code):

Find and read the spec section that governs this feature — Section 1, R4 "Stripe Connect Charge-Type & Loss-Responsibility" in the Pass It Up requirements doc. Tell me: what section you read and what the key rules are.

Search for any existing code in the same area:

Any existing Stripe Connect configuration, webhook handlers for disputes/chargebacks

Any existing dispute-cost or loss-accounting logic
Tell me: what exists and whether your new code could conflict with it.

State your Definition of Done:
"This feature is complete when a user can [X] and the data shows [Y]"
This must come from the spec — not from "it compiles." (Note: "user" here may be an internal finance/admin user reviewing dispute accounting, since this is largely a backend/config feature. Confirm the dispute-cost timeline is based on actual completion timestamp, not expected window.)

THEN implement. After implementing, run your own DoD check and report pass/fail for each item.
Update the test cases in MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md to cover the changes
and give me the handoff once done.

WAVE 3 — Payout & Fee Engine
Both depend on R2's events being live. R1 specifically needs R2's real completion/cancellation events to correctly implement first-trade eligibility consumption.

R3 — Delayed Seller Payout + Buffer (PLAN MODE FIRST)
TASK TYPE: New Implementation

WHAT I WANT:
Implement a delayed seller payout mechanism where, after a trade is captured and completed, the seller's payout is scheduled to release only after a configurable buffer period (not instantly). The buffer length must be admin-tunable, and the payout release date must be computed and stored based on the buffer value in effect when the trade completes. Key the payout release date off the actual completion/capture timestamp, not a fixed original-window expectation, so that a trade completed later (e.g., due to a granted R15 extension in Wave 7) naturally produces a correctly later payout date with no special-case logic needed.

CONTEXT:

Affects: Trade completion flow, seller balance/payout ledger, admin config panel

App layer: Edge Function (payout scheduler) + DB migration (payout schedule table, buffer config) + RPC

YOUR PRE-FLIGHT (do this BEFORE writing any code):

Find and read the spec section that governs this feature — Section 1, R3 "Delayed Seller Payout + Buffer" in the Pass It Up requirements doc. Tell me: what section you read and what the key rules are.

Search for any existing code in the same area:

Any existing payout, transfer, or Stripe Connect payout-triggering logic

Any seller balance ledger or admin config table for timing rules
Tell me: what exists and whether your new code could conflict with it.

State your Definition of Done:
"This feature is complete when a user can [X] and the data shows [Y]"
This must come from the spec — not from "it compiles." (Confirm the payout date is computed from actual completion timestamp, not expected window.)

THEN implement. After implementing, run your own DoD check and report pass/fail for each item.
Update the test cases in MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md to cover the changes
and give me the handoff once done.

R1 — Tiered Buyer-Fee Engine (first-trade protection) (PLAN MODE FIRST)
TASK TYPE: New Implementation

WHAT I WANT:
Implement a tiered buyer-fee resolution engine at checkout with three fee states: (1) active members (trial or paid) always pay a flat $1.49 "Safety & Platform Fee"; (2) free users with no completed trade pay a flat $1.49 on their first trade; (3) free users with one or more completed trades pay 5% of the cash portion + $1.99, capped at $4.99. There is NO separate pricing tier for exactly-one-completed-trade versus multiple-completed-trades — the moment a free user's first trade completes, they permanently pay the percentage-based fee (5% + $1.99, cap $4.99) on every checkout thereafter, until/unless they become an active member. Only one fee is charged per checkout regardless of bundle size (single seller, multiple items). The percentage-based fee applies only to the cash portion of the order, never to any Swap-Points-covered amount. First-trade eligibility is a state, not a counter — it is consumed ONLY when a trade is successfully captured and completed; it is NOT consumed if the trade is cancelled, times out, fails capture, or is refunded (it remains available for the next attempt). Track the buyer's fee-state explicitly through: no_completed_trade → first_trade_in_progress → first_trade_completed → subsequent_free → active_member — where first_trade_completed is a momentary transition marker at the instant of first-trade completion, not a distinct checkout-pricing tier; any checkout occurring after that transition (i.e., 1+ completed trades) resolves to the subsequent_free percentage-fee pricing.

CONTEXT:

Affects: Checkout / order summary screen, fee calculation service, buyer profile/trade-history data model

App layer: Mobile UI + Edge Function (fee calculation) + DB migration (fee-state field + completed-trade counter) + RPC

YOUR PRE-FLIGHT (do this BEFORE writing any code):

Find and read the spec section that governs this feature — Section 1, R1 "Tiered Buyer-Fee Engine (first-trade protection)" in the Pass It Up requirements doc. Tell me: what section you read and what the key rules are.

Search for any existing code in the same area:

Any function, trigger, RPC, or Edge Function computing buyer fees, platform fees, or checkout totals

Any table/field tracking completed trades, buyer trade history, or membership status
Tell me: what exists and whether your new code could conflict with it.

State your Definition of Done:
"This feature is complete when a user can [X] and the data shows [Y]"
This must come from the spec — not from "it compiles." (Base it on all 7 Gherkin scenarios under R1, including the cancelled/refunded non-consumption case. Explicitly test that a free user with exactly 1 completed trade pays the percentage fee, not a flat fee, at their next checkout. Confirm fee-state consumption is triggered strictly by the completion event, not by elapsed time, so it requires no special handling during any future extension-consent wait in R15.)

THEN implement. After implementing, run your own DoD check and report pass/fail for each item.
Update the test cases in MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md to cover the changes
and give me the handoff once done.

WAVE 4 — Swap Points Economy
R5's own Gherkin acceptance criteria reference the category cap/multiplier — R11 must exist first. R6 and R13 compose on top of R5.

R11 — Category SP Caps & Multiplier Config
TASK TYPE: New Implementation

WHAT I WANT:
Build an admin config UI/API so admins can set a spend cap percentage and a multiplier (m) per listing category. These values must be enforced by the R5 checkout redemption logic.

CONTEXT:

Affects: Admin category config panel, R5 checkout redemption logic (consumer of this config)

App layer: Admin UI + DB migration (category config table) + RPC

YOUR PRE-FLIGHT (do this BEFORE writing any code):

Find and read the spec section that governs this feature — Section 2, R11 "Category SP Caps & Multiplier Config" in the Pass It Up requirements doc. Tell me: what section you read and what the key rules are.

Search for any existing code in the same area:

Any existing category management admin screens

Confirm R5's redemption logic and how it will read this config (dependency check)
Tell me: what exists and whether your new code could conflict with it.

State your Definition of Done:
"This feature is complete when a user can [X] and the data shows [Y]"
This must come from the spec — not from "it compiles." (An admin sets cap % and m for a category, and R5 checkout enforces both correctly.)

THEN implement. After implementing, run your own DoD check and report pass/fail for each item.
Update the test cases in MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md to cover the changes
and give me the handoff once done.

R5 — Swap Points Redemption at Checkout (m x S) (PLAN MODE FIRST)
TASK TYPE: New Implementation

WHAT I WANT:
Implement Swap Points (SP) redemption at checkout for listings the seller has opted into accepting SP. The buyer can apply S Swap Points, limited by the item's category cap. The seller receives m x S Swap Points (m = category multiplier), with net new SP created equal to (m - 1) x S — the multiplier never applies to cash. Cash portion = P - S, and the seller fee (5%) applies to the cash portion only. If zero SP is applied, no multiplier or SP award is generated (pure cash sale). On trade completion, SP is released to the seller but enters a 3-day pending window before it becomes spendable.

CONTEXT:

Affects: Checkout / offer screen (SP input), listing settings (SP opt-in + category), seller SP balance, fee calculation service

App layer: Mobile UI + Edge Function (SP math + release scheduler) + DB migration (SP ledger, pending window, category caps/multipliers) + RPC

YOUR PRE-FLIGHT (do this BEFORE writing any code):

Find and read the spec section that governs this feature — Section 1, R5 "Swap Points Redemption at Checkout (m x S)" in the Pass It Up requirements doc. Tell me: what section you read and what the key rules are.

Search for any existing code in the same area:

Any existing SP balance, SP ledger, or SP earn/spend logic

Any existing category configuration table (needed for R11 caps/multipliers)
Tell me: what exists and whether your new code could conflict with it.

State your Definition of Done:
"This feature is complete when a user can [X] and the data shows [Y]"
This must come from the spec — not from "it compiles." (Cover cap enforcement, multiplier math, cash-only path, and the 3-day pending window. Confirm the pending-window timer is triggered strictly by the completion event, not elapsed time, so it requires no special handling during any future extension-consent wait in R15.)

THEN implement. After implementing, run your own DoD check and report pass/fail for each item.
Update the test cases in MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md to cover the changes
and give me the handoff once done.

R6 — Subscription Entitlement Gating (SP earn/spend) (PLAN MODE FIRST)
TASK TYPE: New Implementation

WHAT I WANT:
Gate SP earn/spend ability by subscription state. Trial or paid members can earn and spend SP. Users in grace period can spend existing SP but cannot earn new SP, and they pay the free-user fee (per R13). Once grace period ends, the user's SP balance is frozen — they can neither earn nor spend. If a user with a frozen balance resubscribes, their frozen SP balance becomes available again. This must integrate with R5 (redemption) and R1 (fee-state) so entitlement checks run before any SP action is allowed.

CONTEXT:

Affects: Checkout / SP redemption flow, subscription status service, SP balance ledger

App layer: Edge Function (entitlement check middleware) + DB migration (SP freeze flag, grace period tracking) + RPC

YOUR PRE-FLIGHT (do this BEFORE writing any code):

Find and read the spec section that governs this feature — Section 1, R6 "Subscription Entitlement Gating (SP earn/spend)" in the Pass It Up requirements doc. Tell me: what section you read and what the key rules are.

Search for any existing code in the same area:

Existing subscription status/lifecycle code (trial, paid, cancel — per B3 "already built")

Any existing SP earn/spend gating or balance-freeze logic
Tell me: what exists and whether your new code could conflict with it.

State your Definition of Done:
"This feature is complete when a user can [X] and the data shows [Y]"
This must come from the spec — not from "it compiles." (Cover all four states: trial/paid, grace, post-grace frozen, and resubscription restore.)

THEN implement. After implementing, run your own DoD check and report pass/fail for each item.
Update the test cases in MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md to cover the changes
and give me the handoff once done.

R13 — Grace-Period Fee Treatment
TASK TYPE: New Implementation

WHAT I WANT:
When a user is in the grace period, they pay the free-user fee (per R1's subsequent_free tier: 5% of cash portion + $1.99, capped at $4.99) at checkout, and they may spend existing SP but not earn new SP (per R6).

CONTEXT:

Affects: Checkout fee calculation (R1), SP entitlement gating (R6)

App layer: Edge Function (fee + entitlement resolution, shared with R1/R6) — this is largely a rule-integration task, not new infrastructure

YOUR PRE-FLIGHT (do this BEFORE writing any code):

Find and read the spec section that governs this feature — Section 2, R13 "Grace-Period Fee Treatment" in the Pass It Up requirements doc. Tell me: what section you read and what the key rules are.

Search for any existing code in the same area:

R1's fee-state logic and R6's entitlement gating logic (this requirement should compose, not duplicate, both)
Tell me: what exists and whether your new code could conflict with it.

State your Definition of Done:
"This feature is complete when a user can [X] and the data shows [Y]"
This must come from the spec — not from "it compiles." (A grace-period user must see the free-user fee at checkout and be blocked from earning SP while still able to spend it.)

THEN implement. After implementing, run your own DoD check and report pass/fail for each item.
Update the test cases in MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md to cover the changes
and give me the handoff once done.

WAVE 5 — Independent Parallel Tracks
No hard dependency on Waves 1-4. Run in parallel on a second agent thread, or slot in whenever convenient.

R7 — Web-First Subscription Purchase + Status Sync (Option A) (PLAN MODE FIRST)
Full user journey this prompt must implement end-to-end (locked 2026-08-09):

Step	What happens	Where
1	Parent downloads Pass It Up, creates a free account, browses, lists, and trades	In app
2	Parent encounters a "Join Kids Club" prompt/CTA surfacing the membership value prop (earn SP, $0.99 fee instead of free-user fee)	In app
3	App shows a manage-membership message pointing to the web (e.g., "Manage your membership at passitup.com") — NO purchase button anywhere inside the iOS/Android app	In app
4	Parent goes to the website, subscribes via Stripe, with support for Apple Pay, Google Pay, and card	Web
5	Stripe confirms the subscription; the backend receives this confirmation (webhook) and flags that account as "subscribed"	Backend
6	Parent returns to the app; the app reads the subscription status; member benefits (SP earn/spend per R6, $1.49 flat fee per R1) unlock	In app
Renewal	Stripe auto-charges the web-side card on file monthly/annually; the backend re-syncs status on each renewal/failure so the app stays accurate	Web/backend
TASK TYPE: New Implementation

WHAT I WANT:
Implement the full web-first subscription journey end-to-end, exactly as the 7-step table above describes — this is not just "hide the buy button," it's the entire funnel from in-app discovery through web purchase, backend confirmation, app-side unlock, and ongoing renewal sync.

Specifically:

In-app discovery (Step 2): Add a "Join Kids Club" prompt/entry point inside the app (e.g., during checkout, on a benefits/paywall screen, or in account settings) that explains the membership value prop (earn Swap Points, pay the flat $1.49/reduced member fee instead of the free-user percentage fee). This prompt must NOT contain any purchase button, price-selection UI, or App Store/Play Store billing trigger of any kind.

Redirect messaging (Step 3): When the parent taps the "Join Kids Club" prompt, show explicit instructional copy telling them to complete the subscription on the web (e.g., "Manage your membership at passitup.com"), optionally with a tappable link/QR code that opens the web checkout in an external browser (not an in-app webview that could be construed as in-app purchase flow, per App Store guideline 3.1.3).

Web checkout (Step 4): On the web, build (or confirm existing) a Stripe Checkout / Payment Element flow that supports Apple Pay, Google Pay, and standard card entry for the subscription purchase, with no app-store commission taken.

Backend confirmation (Step 5): On successful Stripe subscription creation, handle the Stripe webhook (e.g., customer.subscription.created) to flag the corresponding user account as "subscribed" in the backend, tying the web Stripe customer/subscription ID to the existing app user account (resolve how this linkage happens if the parent wasn't already logged into a web session tied to their app account — e.g., email match, magic link, or account linking at web-checkout time).

Status sync + benefit unlock (Step 6): When the parent reopens the app, the app must read the current subscription tier and renewal status from the backend and immediately reflect member benefits unlocking — specifically, this must correctly hand off to R6 (SP earn/spend gating) and R1 (flat $1.49 member fee) so both take effect without requiring a separate manual sync step.

Renewal sync (Renewal row): Handle Stripe's recurring auto-charge on the web-side card on file. On each successful renewal, re-confirm "subscribed" status in the backend. On a failed renewal charge, correctly transition the account into whatever grace-period/lapsed state R6 defines (do not leave the account silently "subscribed" past a failed charge), and ensure the app reflects the updated status on next open.

CONTEXT:

Affects: In-app paywall/benefits screen (new "Join Kids Club" entry point), web checkout flow (Stripe Payment Element/Checkout with Apple Pay/Google Pay/card), backend webhook handler, account-linking logic (web purchase → app account), subscription status API, R6's entitlement gating (consumer of this status), R1's fee resolution (consumer of this status)

App layer: Mobile UI (in-app CTA + redirect messaging, NO purchase UI) + Web checkout (Stripe Payment Element, Apple Pay/Google Pay/card) + Edge Function (Stripe webhook handler, account-linking logic, status sync endpoint) + RPC + DB migration (subscription-to-account linkage, renewal/failure state)

YOUR PRE-FLIGHT (do this BEFORE writing any code):

Find and read the spec section that governs this feature — Section 1, R7 "Web-First Subscription Purchase + Status Sync (Option A)" in the Pass It Up requirements doc, plus the full 7-step journey table locked above. Tell me: what section you read, what the key rules are, and confirm you've mapped each of the 7 journey steps to a concrete implementation task.

Search for any existing code in the same area:

Any existing in-app purchase (IAP) UI, paywall screen, or App Store/Play Store billing integration that needs removal or repurposing into the new non-purchase "Join Kids Club" prompt

Any existing web checkout page or Stripe integration that could be extended for Step 4, including whether Apple Pay/Google Pay are already enabled on the Stripe account/Payment Element config

Any existing webhook handler for Stripe subscription events, and any existing mechanism for linking a web-side Stripe customer to an app-side user account

R6's entitlement gating logic and R1's fee resolution logic, to confirm exactly what status field/flag they read so Step 6's "benefits unlock" wires into both correctly
Tell me: what exists and whether your new code could conflict with it.

State your Definition of Done:
"This feature is complete when a user can [X] and the data shows [Y]"
This must come from the spec and the 7-step journey — not from "it compiles." At minimum, your DoD must include: (a) the in-app "Join Kids Club" prompt is visible and contains zero purchase UI, (b) tapping it shows the correct web-redirect messaging and opens an external (non-webview) browser, (c) the web checkout completes via Stripe with Apple Pay, Google Pay, and card all functional, (d) the Stripe webhook correctly flags the linked app account as subscribed, (e) reopening the app reflects the new tier/status without manual refresh, (f) R6's SP earn/spend gating and R1's $1.49 member fee both activate correctly upon that status change, (g) a simulated renewal charge (success and failure cases) both correctly update backend status and the app reflects it on next open.

THEN implement. After implementing, run your own DoD check and report pass/fail for each item.
Update the test cases in MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md to cover the changes — including a full end-to-end test walking through all 7 journey steps, plus the renewal-success and renewal-failure cases —
and give me the handoff once done.

R8 — Core Trust & Safety Gates (PLAN MODE FIRST)
TASK TYPE: New Implementation

WHAT I WANT:
Implement listing review gates: every new listing enters a review queue and is not publicly visible until approved. Each listing is checked against CPSC recall data and flagged if matched. Every uploaded listing image must pass Google Vision moderation before the listing can be approved. New user registration requires phone/email verification; seller ID verification is available as an optional trust badge (not required to sell).

CONTEXT:

Affects: Listing creation flow, admin review queue, image upload pipeline, user registration/onboarding

App layer: Mobile UI + Edge Function (CPSC check, Google Vision integration, review queue logic) + DB migration (review status, verification flags) + third-party API integrations (CPSC data source, Google Vision)

YOUR PRE-FLIGHT (do this BEFORE writing any code):

Find and read the spec section that governs this feature — Section 1, R8 "Core Trust & Safety Gates" in the Pass It Up requirements doc. Tell me: what section you read and what the key rules are.

Search for any existing code in the same area:

Any existing listing approval/review workflow

Any existing image moderation or third-party moderation API calls

Any existing phone/email verification flow
Tell me: what exists and whether your new code could conflict with it.

State your Definition of Done:
"This feature is complete when a user can [X] and the data shows [Y]"
This must come from the spec — not from "it compiles." (Cover: listing hidden pre-approval, CPSC flag behavior, image moderation gate, and required vs. optional verification.)

THEN implement. After implementing, run your own DoD check and report pass/fail for each item.
Update the test cases in MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md to cover the changes
and give me the handoff once done.

N5 — Seller Masking (Cross-Cutting)
TASK TYPE: New Implementation

WHAT I WANT:
Mask seller identity until a trade becomes active (offer accepted). Any "same seller" indicator shown to buyers browsing multiple listings must be non-identifying (e.g., a generic badge, not a name/photo).

CONTEXT:

Affects: Listing browse/detail screens, trade detail screen (post-acceptance reveal)

App layer: Mobile UI + Edge Function/RPC (identity reveal logic gated by trade state)

YOUR PRE-FLIGHT (do this BEFORE writing any code):

Find and read the spec section that governs this feature — Section 5, N5 "Seller masking" in the Pass It Up requirements doc. Tell me: what section you read and what the key rules are.

Search for any existing code in the same area:

Any existing seller profile display logic on listing/browse screens

Any existing "same seller" grouping or badge feature
Tell me: what exists and whether your new code could conflict with it.

State your Definition of Done:
"This feature is complete when a user can [X] and the data shows [Y]"
This must come from the spec — not from "it compiles." (Seller identity must be hidden pre-trade and revealed only once a trade is active, with badges remaining non-identifying throughout.)

THEN implement. After implementing, run your own DoD check and report pass/fail for each item.
Update the test cases in MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md to cover the changes
and give me the handoff once done.

N4 — Data Privacy / COPPA (Cross-Cutting) (PLAN MODE FIRST)
TASK TYPE: New Implementation

WHAT I WANT:
Enforce COPPA compliance: block creation of accounts for under-13 users and prevent collection of any personal data from under-13 individuals. This must be enforced at registration and anywhere age or birthdate is captured.

CONTEXT:

Affects: Registration flow, any age/birthdate input, data collection points

App layer: Mobile UI (age gate) + Edge Function (validation) + DB migration (age verification flag)

YOUR PRE-FLIGHT (do this BEFORE writing any code):

Find and read the spec section that governs this feature — Section 5, N4 "Data privacy" in the Pass It Up requirements doc. Tell me: what section you read and what the key rules are.

Search for any existing code in the same area:

Any existing age verification or registration validation logic

Any existing data collection points that might inadvertently capture under-13 data
Tell me: what exists and whether your new code could conflict with it.

State your Definition of Done:
"This feature is complete when a user can [X] and the data shows [Y]"
This must come from the spec — not from "it compiles." (An under-13 registration attempt must be blocked with no data persisted.)

THEN implement. After implementing, run your own DoD check and report pass/fail for each item.
Update the test cases in MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md to cover the changes
and give me the handoff once done.

R10 — Tax Engine Behaviors
TASK TYPE: New Implementation

WHAT I WANT:
Using the existing admin-configured tax rates/exemptions (per node, per category — B4), resolve the applicable tax rate at checkout based on the item's node and category. If a category is configured exempt in a node, apply no sales tax. Record all collected tax as pass-through (collected/payable liability), not as platform revenue.

CONTEXT:

Affects: Checkout flow, tax admin config (existing), finance/revenue reporting

App layer: Edge Function (tax resolution at checkout) + DB read (existing tax config) + accounting/ledger tagging

YOUR PRE-FLIGHT (do this BEFORE writing any code):

Find and read the spec section that governs this feature — Section 2, R10 "Tax Engine Behaviors" in the Pass It Up requirements doc. Tell me: what section you read and what the key rules are.

Search for any existing code in the same area:

The existing tax collect engine (B4, "already built") — confirm what it already does vs. what's missing

Any existing revenue/ledger reporting that needs a pass-through tag added
Tell me: what exists and whether your new code could conflict with it.

State your Definition of Done:
"This feature is complete when a user can [X] and the data shows [Y]"
This must come from the spec — not from "it compiles." (Cover correct rate resolution, exemption handling, and pass-through accounting.)

THEN implement. After implementing, run your own DoD check and report pass/fail for each item.
Update the test cases in MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md to cover the changes
and give me the handoff once done.

WAVE 6 — Cross-Feature Composition
R12 needs both R8's "approved listing" event and R2's "completed trade" event. N3 needs R4's dispute webhook and R2's trade data. Treat R9 as continuous — instrument each feature's events as it's built in Waves 2-5, then use this wave as a final completeness sweep.

R12 — Referral SP (Action-Gated)
TASK TYPE: New Implementation

WHAT I WANT:
Issue referral SP to a referred user only when they complete their first approved listing OR their first completed trade — never on raw signup alone.

CONTEXT:

Affects: Referral tracking, listing approval flow (R8), trade completion flow (R2)

App layer: Edge Function (referral SP trigger on approved-listing or completed-trade events) + DB migration (referral tracking, SP issuance)

YOUR PRE-FLIGHT (do this BEFORE writing any code):

Find and read the spec section that governs this feature — Section 2, R12 "Referral SP (action-gated)" in the Pass It Up requirements doc. Tell me: what section you read and what the key rules are.

Search for any existing code in the same area:

Any existing referral tracking/attribution system

Any existing SP issuance triggers tied to signup (which would need to be removed/corrected if present)
Tell me: what exists and whether your new code could conflict with it.

State your Definition of Done:
"This feature is complete when a user can [X] and the data shows [Y]"
This must come from the spec — not from "it compiles." (Confirm no SP issues on signup, and SP issues correctly on first approved listing OR first completed trade, whichever comes first.)

THEN implement. After implementing, run your own DoD check and report pass/fail for each item.
Update the test cases in MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md to cover the changes
and give me the handoff once done.

N3 — Dispute Evidence Packaging (Cross-Cutting)
TASK TYPE: New Implementation

WHAT I WANT:
Automatically package dispute evidence for Stripe when a chargeback is filed: buyer/seller messaging history, trade completion timestamp, and pickup location. This should assemble automatically without manual admin effort.

CONTEXT:

Affects: Dispute webhook handler, messaging data store, trade record

App layer: Edge Function (evidence assembly + Stripe API submission) + DB read (messages, trade completion data)

YOUR PRE-FLIGHT (do this BEFORE writing any code):

Find and read the spec section that governs this feature — Section 5, N3 "Dispute evidence" in the Pass It Up requirements doc. Tell me: what section you read and what the key rules are.

Search for any existing code in the same area:

Any existing dispute webhook handler (likely shared with R4)

Any existing messaging log or trade timestamp/location storage
Tell me: what exists and whether your new code could conflict with it.

State your Definition of Done:
"This feature is complete when a user can [X] and the data shows [Y]"
This must come from the spec — not from "it compiles." ("User" here is likely an admin/finance reviewer confirming the packaged evidence submits correctly to Stripe.)

THEN implement. After implementing, run your own DoD check and report pass/fail for each item.
Update the test cases in MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md to cover the changes
and give me the handoff once done.

R9 — Minimal Event Instrumentation
Run as a continuous thread across Waves 2-5, then use this as the final completeness sweep.

TASK TYPE: New Implementation

WHAT I WANT:
Instrument the app to capture pilot analytics events: funnel events (registered, activated = first listing OR first purchase, engaged = completed trade within 30 days); checkout events (fee shown, checkout completed or not); subscription events (trial start, conversion to paid, 30/60/90-day retention); SP events (issued, redeemed, outstanding, pending, frozen); trade outcome events (completed, cancelled, timed-out). Every event must be tagged to its node.

CONTEXT:

Affects: Registration flow, listing creation, checkout, subscription lifecycle, SP ledger, trade lifecycle — cuts across nearly all app layers

App layer: Mobile UI (event triggers) + Edge Function (event capture/forwarding) + DB migration or analytics pipeline (event schema, node tag field)

YOUR PRE-FLIGHT (do this BEFORE writing any code):

Find and read the spec section that governs this feature — Section 1, R9 "Minimal Event Instrumentation" in the Pass It Up requirements doc. Tell me: what section you read and what the key rules are.

Search for any existing code in the same area:

Any existing analytics/event tracking library or pipeline already integrated

Any existing node-tagging convention on users/listings/trades
Tell me: what exists and whether your new code could conflict with it.

State your Definition of Done:
"This feature is complete when a user can [X] and the data shows [Y]"
This must come from the spec — not from "it compiles." (Cover each event category listed and confirm node tagging on all of them.)

THEN implement. After implementing, run your own DoD check and report pass/fail for each item.
Update the test cases in MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md to cover the changes
and give me the handoff once done.

WAVE 7 — Post-Day-1 (COULD), in dependency order
Hold until Day-1 (Waves 0-6) ships. R16 stays gated regardless of engineering readiness until the liquidity condition from the business plan is met.

R15 — Re-Authorization on Extension (PLAN MODE FIRST)
Product decisions locked in for this prompt (resolved 2026-08-09):

Scope: Extension applies to the pickup window only, not the offer window. The offer window is a binary accept/decline decision by the seller and does not support "more time" requests; only the post-acceptance pickup window (physical handoff) can be extended.

Consent model: Either party (buyer or seller) may initiate an extension request, but it only takes effect if the counterparty accepts. If the counterparty does not respond within 4 hours of the request, the request auto-denies (defaults to "no extension") and the original pickup countdown continues unaffected.

Extension mechanism: On mutual acceptance, void the existing payment hold entirely and attempt a brand-new authorization (not an incremental top-up, and not a cumulative-time calculation against the original 7-day ceiling — a fresh authorization is a new transaction with its own independent authorization window). Limit this to exactly one extension per trade to avoid repeated-authorization fraud signals and card-decline risk on retries.

Timers during the 4-hour consent wait: R1's fee-state consumption and R5's SP pending-release timer are both triggered by the trade-completion event, not by elapsed window time — neither runs or needs to pause during the 4-hour consent window. No special-case handling is needed; confirm this in pre-flight rather than building pause/resume logic.

Reminders: Reuse R2's existing in-app/push reminder infrastructure — do not build a parallel notification path. Fire a notification to the counterparty the moment an extension is requested (prompting accept/decline), and a notification to the requester once the outcome (granted/denied/timed-out-no-response) is known.

Denial / failure handling: If the counterparty denies, the 4-hour response window times out, or the fresh authorization fails, the trade immediately auto-cancels and the payment hold releases, following R2's existing expiry-and-release behavior exactly. There is no retry-payment-method flow or grace period — the buyer must re-initiate a new trade if they still want the item.

Downstream timeline effects: A granted extension retroactively (and correctly) shifts R3's payout-buffer start date and R4's dispute-cost clock later, since both already key off the actual completion/capture timestamp rather than the original expected window. This should require no special-case code in R3 or R4 — confirm this holds true rather than assuming it.

Idempotency/audit event type: Requesting and completing an extension creates a second, distinct authorization on the same payment method. This must be logged in N2's audit trail as its own event type (e.g., trade_extension_reauth), separate from the original trade_authorization event, with its own idempotency key — not treated as a retry of the original authorization.

TASK TYPE: New Implementation

WHAT I WANT:
Implement a one-time trade extension flow, scoped to the pickup window only (not the offer window). Either the buyer or the seller may request more time during an active pickup window. The request is sent to the counterparty, who must accept within 4 hours; no response within 4 hours auto-denies the request and the original pickup countdown continues unaffected. If the counterparty accepts, void the existing payment hold and attempt a completely fresh authorization (not an incremental extension of the old one). If the new authorization succeeds, grant the extension and start a new pickup window; if it fails, or if the counterparty denies, or if the 4-hour response window times out, immediately auto-cancel the trade and release the hold, using the exact same auto-cancel/release behavior R2 already uses for expired offer/pickup windows. Allow only one extension per trade — a second request on the same trade must be rejected outright regardless of outcome. Reuse R2's existing in-app/push reminder system: notify the counterparty when a request is made, and notify the requester when the outcome is determined (granted, denied, timed-out, or failed re-auth). Confirm that R1's fee-state and R5's SP pending-release timers require no changes (they trigger on completion, not elapsed time), and that R3's payout buffer and R4's dispute-cost clock naturally shift to the later actual completion date with no special-case code.

CONTEXT:

Affects: Trade detail screen (extension request UI, accept/decline UI, pickup countdown display), payment hold logic (shared with R2), notification system (shared with R2), audit logging (shared with N2)

App layer: Mobile UI + Edge Function (request/consent/void/re-auth flow, one-extension-per-trade enforcement) + DB migration (extension request state, one-time-use flag) + Stripe integration + reuse of R2's reminder/notification service + N2's audit log (new event type)

YOUR PRE-FLIGHT (do this BEFORE writing any code):

Find and read the spec section that governs this feature — Section 3, R15 "Re-Authorization on Extension" in the Pass It Up requirements doc, plus the eight product decisions locked in above. Tell me: what section you read and what the key rules are, and confirm you've incorporated all eight locked decisions into your plan.

Search for any existing code in the same area:

R2's auth-and-capture state machine and its existing auto-cancel/release logic (this feature must call the SAME release path, not a duplicate one) — confirm the pickup window specifically (not the offer window) is where you're hooking in

R2's existing reminder/notification service (confirm the hook points for "request made" and "outcome determined" events)

N2's idempotency/audit log implementation — confirm it supports (or can be extended to support) a distinct trade_extension_reauth event type with its own idempotency key, separate from the original authorization event. If N2 does not yet support a second event type cleanly, STOP and report this gap before proceeding, since it may require a small N2 amendment first.

R3's payout-scheduling logic and R4's dispute-cost-accounting logic — confirm both key off the actual completion/capture timestamp (not the originally expected window), so no changes are needed there for this feature to work correctly.

Any existing consent/accept-decline UI pattern already used elsewhere in the app (e.g., seller accept/decline on the original offer) that this can reuse for consistency
Tell me: what exists and whether your new code could conflict with it.

State your Definition of Done:
"This feature is complete when a user can [X] and the data shows [Y]"
This must come from the spec and the eight locked decisions — not from "it compiles." At minimum, your DoD must include: (a) extension requests are only offered/accepted during the pickup window, never the offer window, (b) a request with no counterparty response auto-denies at 4 hours, (c) mutual acceptance triggers a real void + fresh Stripe authorization, (d) a second extension request on the same trade is rejected, (e) denial/timeout/re-auth-failure all route through R2's existing auto-cancel/release path with no new release logic duplicated, (f) both parties receive the correct notification at request and at outcome via R2's existing reminder system, (g) the extension re-authorization is logged as a distinct trade_extension_reauth audit event with its own idempotency key, (h) a trade that completes later due to a granted extension shows the correct (later) payout buffer date in R3's data and correct dispute-cost timeline basis in R4's data, with no special-case code required.

THEN implement. After implementing, run your own DoD check and report pass/fail for each item.
Update the test cases in MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md to cover the changes — including the pickup-window-only scope, the one-extension-per-trade limit, the 4-hour auto-deny, the re-auth-failure path, the distinct audit event type, and the downstream R3/R4 date confirmation —
and give me the handoff once done.

R17 — In-House AI Review Tool (PLAN MODE FIRST)
TASK TYPE: New Implementation

WHAT I WANT:
Build a risk-based AI review workflow intended to replace manual listing review (R8) after a few months of pilot data. Low-risk listings should be auto-approved or fast-tracked; higher-risk listings should still route to human review. This should be designed as a drop-in enhancement to the R8 review queue, not a replacement architecture.

CONTEXT:

Affects: Listing review queue (R8), admin review dashboard

App layer: Edge Function (risk scoring + AI moderation call) + DB migration (risk score field, routing logic) — depends on R8 being in place first

YOUR PRE-FLIGHT (do this BEFORE writing any code):

Find and read the spec section that governs this feature — Section 3, R17 "In-House AI Review Tool" in the Pass It Up requirements doc. Tell me: what section you read and what the key rules are.

Search for any existing code in the same area:

R8's review queue implementation (this is a direct dependency — confirm it exists and how risk scoring should hook in)

Any existing ML/AI moderation calls already in the codebase (e.g., Google Vision from R8) that could be extended vs. duplicated
Tell me: what exists and whether your new code could conflict with it.

State your Definition of Done:
"This feature is complete when a user can [X] and the data shows [Y]"
This must come from the spec — not from "it compiles." (Low-risk listings route correctly without human review; high-risk listings still require it; no listing bypasses review entirely by accident.)

THEN implement. After implementing, run your own DoD check and report pass/fail for each item.
Update the test cases in MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md to cover the changes
and give me the handoff once done.

R14 — Sponsorship Module (PLAN MODE FIRST)
TASK TYPE: New Implementation

WHAT I WANT:
Build node sponsor-eligibility evaluation: a node becomes sponsor-eligible when it is at least 6 months old, has MAU ≥ 150, has ≥ 60 completed trades/month, is liquidity-healthy, has measurement enabled, and has no material unresolved safety issue. Implement "Verified Meetup Location" as a status granted only through independent safety qualification (never purchasable), fully separate from "Sponsored Local Partner" placement, which is a distinct paid product.

CONTEXT:

Affects: Node metrics/KPI dashboard (depends on R9 instrumentation and N6 node tagging), admin sponsorship management, safety review workflow

App layer: Edge Function (eligibility evaluation job) + DB migration (sponsorship eligibility flags, safety qualification records) + Admin UI

YOUR PRE-FLIGHT (do this BEFORE writing any code):

Find and read the spec section that governs this feature — Section 3, R14 "Sponsorship Module" in the Pass It Up requirements doc. Tell me: what section you read and what the key rules are.

Search for any existing code in the same area:

Confirm R9 (instrumentation) and N6 (node tagging) are in place, since eligibility depends on them

Any existing safety-review or trust-badge workflow that "Verified Meetup Location" should reuse
Tell me: what exists and whether your new code could conflict with it.

State your Definition of Done:
"This feature is complete when a user can [X] and the data shows [Y]"
This must come from the spec — not from "it compiles." (An admin can see which nodes are sponsor-eligible per the 6 criteria, and safety status is never conflated with paid placement.)

THEN implement. After implementing, run your own DoD check and report pass/fail for each item.
Update the test cases in MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md to cover the changes
and give me the handoff once done.

R18 — Territory Operator / Franchise (PLAN MODE FIRST)
TASK TYPE: New Implementation

WHAT I WANT:
Build the data model and admin tooling needed to support a future territory operator / franchise model, understanding this generates $0 revenue through Month 36 and is post-proof-only — do not build monetization logic yet, only the structural groundwork (territory/node ownership records, operator roles) needed so it can be activated later without a rebuild.

CONTEXT:

Affects: Node/territory data model, admin role management

App layer: DB migration (territory/operator tables, roles) + Admin UI (read-only/structural, no monetization flows yet)

YOUR PRE-FLIGHT (do this BEFORE writing any code):

Find and read the spec section that governs this feature — Section 3, R18 "Territory Operator / Franchise" in the Pass It Up requirements doc. Tell me: what section you read and what the key rules are.

Search for any existing code in the same area:

N6's node-tagging model (this feature extends node into "territory" — check for naming/schema conflicts)

Any existing admin role/permission system to extend for "operator" role
Tell me: what exists and whether your new code could conflict with it.

State your Definition of Done:
"This feature is complete when a user can [X] and the data shows [Y]"
This must come from the spec — not from "it compiles." (Structural data model exists and is queryable, but no revenue-generating logic is active — confirm this explicitly in your report.)

THEN implement. After implementing, run your own DoD check and report pass/fail for each item.
Update the test cases in MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md to cover the changes
and give me the handoff once done.

R16 — Paid Boosts / Pro Seller (PLAN MODE FIRST)
Gate-driven — hold regardless of engineering readiness until the liquidity gate condition from the business plan is met.

TASK TYPE: New Implementation

WHAT I WANT:
Build a paid listing-boost feature for sellers (post-liquidity, gate-driven — do not enable until the gating condition from the business plan is met), purchased via in-app purchase with a 15% platform take on boost revenue.

CONTEXT:

Affects: Listing management screen (boost purchase UI), seller monetization

App layer: Mobile UI + IAP integration (App Store/Play Store, since boosts are explicitly IAP-based, unlike subscriptions) + Edge Function (boost activation, revenue split tracking)

YOUR PRE-FLIGHT (do this BEFORE writing any code):

Find and read the spec section that governs this feature — Section 3, R16 "Paid Boosts / Pro Seller" in the Pass It Up requirements doc. Tell me: what section you read and what the key rules are.

Search for any existing code in the same area:

Any existing IAP integration (note: this is separate from R7's subscription IAP removal — confirm boosts are intentionally still IAP per spec)

Any existing "gate" or feature-flag pattern used for other gated features (e.g., R14) to reuse for the liquidity gate
Tell me: what exists and whether your new code could conflict with it.

State your Definition of Done:
"This feature is complete when a user can [X] and the data shows [Y]"
This must come from the spec — not from "it compiles." (Confirm the feature stays fully gated/inactive until the liquidity gate condition is explicitly flipped on.)

THEN implement. After implementing, run your own DoD check and report pass/fail for each item.
Update the test cases in MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md to cover the changes
and give me the handoff once done.

Quick Reference: Wave Summary
Wave	Items	Focus
0	B1, B2, B3, B4	Verify existing assumptions before building
1	N1, N6	Config layer + node tagging (foundational)
2	R2, N2, R4	Trade state machine + idempotency (multi-event-type schema) + dispute config
3	R3, R1	Payout buffer + tiered buyer fee (both timestamp-anchored, extension-safe; R1 clarified: 1+ completed trades = percentage fee, no separate exactly-one tier)
4	R11, R5, R6, R13	SP config, redemption, entitlement, grace fees
5	R7, R8, N5, N4, R10	Independent parallel tracks — R7 now covers full 7-step journey (in-app CTA, web redirect copy, Stripe payment methods, webhook flagging, benefit unlock, renewal sync)
6	R12, N3, R9	Cross-feature composition + instrumentation sweep
7	R15, R17, R14, R18, R16	Post-Day-1, dependency-ordered — R15 fully spec'd with 8 locked product decisions
</content>
