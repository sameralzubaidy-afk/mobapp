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

### Prioritized MVP Backlog (Star Rating)

| Priority | Backlog Item | Epic |
|----------|-------------|------|
| ⭐⭐⭐⭐⭐ | AI Intent Extraction for Search | AI Search |
| ⭐⭐⭐⭐⭐ | Hybrid AI Search Architecture | AI Search |
| ⭐⭐⭐⭐⭐ | "Did You Mean?" Search Suggestions | AI Search |
| ⭐⭐⭐⭐☆ | Generate Rich Metadata During Listing Creation | AI Assisted Listing |
| ⭐⭐⭐⭐☆ | Listing Quality Assistant | AI Assisted Listing |
| ⭐⭐⭐⭐☆ | "Coming Soon" Label for AI Price Recommendations | AI Pricing |
| ⭐⭐⭐☆☆ | Search Result Caching | AI Search |
| ⭐⭐⭐☆☆ | AI Confidence Indicators | AI Assisted Listing |
| ⭐⭐⭐☆☆ | AI Analytics Dashboard | Analytics |
| ⭐⭐☆☆☆ | Seller Insights Dashboard | Seller Success |
| ⭐☆☆☆☆ | Personalized Recommendations | Personalization |
| ⭐☆☆☆☆ | Buyer AI Assistant | Personalization |
| ⭐☆☆☆☆ | AI Price Recommendation Engine | AI Pricing |
