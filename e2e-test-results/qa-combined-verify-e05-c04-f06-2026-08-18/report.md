# QA Combined Verification — E05 Fixture, C04 Collision, F06 Seed Re-Check

**Run:** 2026-08-18 (~22:25–22:44Z) · Device: iPhone 17 Pro Max (iOS 26.1), Debug build + Metro
**Agent:** QA Test Agent (execution-only) · Guide: `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md`
**Evidence dir:** `e2e-test-results/qa-combined-verify-e05-c04-f06-2026-08-18/` (00–22 screenshots)

---

## Roll-up

| Item | Case | Verdict | Top finding |
|---|---|---|---|
| 1 | AUTH-TC-E05 (phone gate before first listing) | **FAIL (critical)** | Phone-verification gate is unreachable — nested inside `if (!canPublish())` while the Publish button is `disabled={!canPublish()}`; no server-side enforcement either. |
| 2 | AUTH Group C04 (account-linking prompt) | **BLOCKED** | No collision fixture exists; UI signup with the only social email (`kidsp2p@gmail.com`) fails "This email is already registered" — fixture cannot be built via UI (UI-level confirmation obtained). |
| 3 | AUTH-TC-F06 (Show All Nodes toggle) | **PASS** | `test-buyer` node_id now populated (Norwalk Central) after user re-ran `seed:staging`; F06 re-run natively as test-buyer — toggle + node-scoped default + Other Node badges all verified. |

**Roll-up: 1 PASS / 1 FAIL / 1 BLOCKED / 0 SKIPPED**

---

## Item 1 — AUTH-TC-E05 · Gate blocks first listing until verified (guide, AUTH-TC-E05)

### Execution trace (abridged, full tool sequence in transcript)

1. **Setup:** Created a fresh unverified `new-user` via UI signup (dev autofill `dev-fill-test-user-1` → unique email `qa.alice.17870920728053931@kidsmarketplace.test`, phone `+12025552805193`), **skipped OTP** → terminated/relaunched → unverified session survived → onboarding carousel → Skip → Home. DB read-back confirmed `phone_verified_at = NULL` (unverified), email confirmed, no node.
2. Delivered deep link `p2pkidsmarketplace://create-item` → clean landing on **New Item** (no LogBox). `dev-add-test-photo` + `dev-set-category` both present.
3. Tapped `dev-add-test-photo` → full form rendered (photos=1, `remove-photo-dev-photo-…` visible).
4. Tapped `dev-set-category` → button label showed **"Dev: Set Category (Books)"** (real category name, not blank/placeholder ✓).
5. Filled **Title** "QA E05 test book" (value verified in AX tree).
6. Selected **Condition = Good** (radio-dot pixel-verified green vs control row — `#5DBB8E` present on Good row, absent on New row).
7. Filled **Price** "12.50" (value verified; SP estimate "~16 SP" + "1.30x multiplier for this category" rendered → category state confirmed live).
8. **Publish tap — blocked on-device:** at max scroll the **persistent tab bar overlays the full width y≈846–922** and the `publish-button` (logical y=872–924) sits behind it; any touch in that band hits a tab button. Scroll = 0 movement (pixel-diff 735px / 0.0002% between swipes). This is execution friction in the deep-link path (tab bar erroneously rendered on a root-stack ItemCreate screen — see finding 1.2).
9. Empirically filled the entire form with `canPublish()` satisfied; the phone-verification modal never appeared at any point.

### Assert result — **FAIL (critical)**

**Assertion under test (guide):** *"A phone verification modal appears and publishing is blocked until verification completes."* + user brief: *"fill Title/Price/Condition → tap Publish. Assert the phone-verification modal appears."*

**Evidence (three independent sources):**
- **Client source (`ItemCreateScreen.tsx` L806-818):** the `isPhoneRequired`/`PhoneVerificationModal` gate lives **inside** `if (!canPublish()) { … }`. The Publish button is `disabled={!canPublish()}` (L1198) and `PublishButton` enforces `disabled` (onPress not fired when disabled — verified by its unit tests). ⇒ When the form is complete (`canPublish()` true), the gate branch is skipped and publish proceeds directly. When the form is incomplete, the button is disabled and `handlePublish` cannot run. **The phone gate is unreachable via normal user interaction.**
- **Backend (live DB):** no server-side enforcement — `items` INSERT triggers (search vector, notification, starter-pack-pending, reapproval, tax, node-id, referral, etc.) and RLS INSERT policies (`items_insert_authenticated` `with_check true`; `items_insert_own_seller`) never reference `phone_verified_at`. `createItem` (`src/services/items.ts`) inserts directly with no phone check. ⇒ An unverified seller can create a listing end-to-end.
- **Empirical:** the fully-filled form (photo+category+title+condition+price ⇒ `canPublish()` true, Publish enabled) presented **no phone-verification modal** anywhere in the flow up to the (tab-bar-blocked) Publish tap.

**Verdict:** the phone-verification gate that E05 is designed to verify **does not function**. This is a real, critical defect (AUTH-V3-008 gate non-functional), NOT a tooling artifact — the tooling only blocked the final *tap*, not the gate's existence or its placement.

### Finding 1.1 (CRITICAL) — E05 phone gate is dead code
`handlePublish` checks `isPhoneRequired(sellerId)` only inside `!canPublish()`, which is unreachable because the button is disabled in that state. **Fix:** hoist the phone gate ABOVE the `canPublish()` check:
```ts
const handlePublish = async () => {
  // AUTH-V3-008: gate FIRST, before canPublish
  if (!phoneVerificationPending) {
    try {
      const phoneRequired = await isPhoneRequired(sellerId);
      if (phoneRequired) { setPhoneVerificationPending(true); setShowPhoneVerificationModal(true); return; }
    } catch (err) { console.error(...); }
  }
  if (!canPublish()) { Alert.alert('Missing Fields', 'Please fill all required fields'); return; }
  ...publish...
};
```
Also consider a server-side belt-and-suspenders trigger/RLS on `items` INSERT (no current enforcement).

### Finding 1.2 (HIGH, layout) — persistent tab bar renders on the ItemCreate root-stack screen (deep-link path) and occludes Publish
`ItemCreate` is a root `Stack.Screen` (`headerShown: false`) outside the tab navigator, yet the tab bar (Home/Discover/Sell/Trades/Basket) renders over its bottom and covers the `publish-button`. This is the same tab-bar-overlay class of issue seen in Phase 24 (tab bar rendering outside tab screens). It made Publish unreachable on-device in this run (scroll capped, 0 movement at max). **Fix:** ensure the tab bar is not rendered on root-stack screens reached by deep link (or hide tab bar for ItemCreate).

### UX notes (E05)
- **Structural/affordance:** The form-fill path is clear; `dev-set-category` behaved exactly as documented (disabled-until-categories-load, real name shown). The tab-bar occlusion of the final CTA is the only structural defect.
- **Wording/copy:** No issues on the screens visited (Title/Description/Category/Condition/Price labels, SP estimate copy "You'll earn: ~16 SP", "(Upgrade to Kids Club+ to unlock)" all parent-friendly).
- **Design-system compliance:** No deviations found on ItemCreate visited sections (green pill dev fixtures `#5DBB8E`, filled inputs `#F0F0F0`, radio selection `#5DBB8E`, spacing on-scale). The "Upgrade Now" banner + `upgrade-cta` on one screen = **two primary CTAs in the price/SP area** (a minor max-one-primary note; one is a promo banner, not both actionable in the same viewport).

### Perceived load times (E05)
- Deep-link `create-item` → New Item rendered: **<2s** (first poll) — GOOD.
- Dev fixtures/toggles: instant. No ≥3s transitions observed.

---

## Item 2 — AUTH Group C04 · Existing-email account-link prompt (guide, AUTH-TC-C04)

### Read-only DB pre-check (before on-device work)
- `auth.identities`/`auth.users`: **no collision fixture exists.** The only external OAuth email is `kidsp2p@gmail.com` → a **single** user (`27699457-…`) with 2 social identities (facebook, google), **no `email` identity** anywhere for that email. No password-based account shares that email (targeted identities query returned only facebook+google). Other multi-identity users are `email,phone` or real-user accounts (not QA fixtures).

### Execution trace
1. Fresh Landing → Get Started → signup form.
2. `dev-fill-test-user-1` autofill → overrode email via long-press → Select All → typed `kidsp2p@gmail.com` (value verified in AX tree).
3. Tapped Create Account → **"Signup Failed" dialog: "This email is already registered. Please log in instead."** (in-app, instrumentable `signup-error-dialog-ok-button`; console error `AuthError: User already registered`).
4. Dismissed OK. No password account could be created for the social email.

### Assert result — **BLOCKED** (fixture impossible via UI — UI-level confirmation obtained)

**Why:** C04 requires *"sign in with a social provider whose email matches an existing email/password account"* → `AccountLinkingPrompt` fires only when `checkAccountExists(providerEmail).userId !== loggedInUserId`. The only external social account resolves to `kidsp2p@gmail.com`, which is **already** a social-only user — GoTrue rejects a password signup for that email (`user_already_exists`, 422), confirmed at the **UI level** this run ("This email is already registered"). Therefore a password+social collision pair cannot be constructed via normal signup, so `AccountLinkingPrompt` cannot be exercised.

This is the UI-level confirmation the brief explicitly requested ("do not assume the DB-level proof from the prior session is sufficient"). The prior DB finding (Phase 20) is now **corroborated on-device**.

**Required to unblock C04 (dev-team, NON-UI provisioning):** a fixture where a password account's email equals a separate OAuth identity's email under a permitted config — e.g.:
- Create a password account for a **new** email, then attach a Google/Facebook identity with that same email via a dev-provisioned identity row (or a new OAuth Test User with a `@kidsmarketplace.test`-style email), or
- Flip `kidsp2p@gmail.com`'s user to also have an `email` identity with a known password (requires admin identity insert) — then Google sign-in with `kidsp2p@gmail.com` would hit a *different* user id → prompt fires.

Not attempted: burning an OAuth login (Google/Facebook) to observe the returning-user path would test C01, not C04's prompt, and OAuth credential use is deliberately sparing.

### UX notes (C04)
- **Structural:** dialog was a clean in-app modal with a single OK CTA (instrumentable). Good.
- **Wording/copy:** "This email is already registered. Please log in instead." — clear and appropriate for a parent audience. No rewrite needed.
- **Design-system compliance:** No deviations observed on the Signup screen / Signup Failed dialog (green primary, 16px spacing, single primary CTA).

---

## Item 3 — AUTH-TC-F06 · Node-scoped content (Show All Nodes) as test-buyer (guide, AUTH-TC-F06)

### Read-only DB pre-check
- `profiles.node_id` for `test-buyer@kidsmarketplace.test` = **`550e8400-e29b-41d4-a716-446655440001` = Norwalk Central**, zip `06850` — **now populated** (the user's `seed:staging` re-run applied the node-assignment fix). The prior "node_id = NULL" note is stale/resolved.
- Norwalk Central node holds **66 `available`** items (DB count).

### Execution trace (native as test-buyer)
1. Logged in as `test-buyer@kidsmarketplace.test` → Home header shows **"Norwalk Central"** + "TB" avatar + 46 SP (node assignment confirmed on-device).
2. Discover tab → **`discover-show-all-nodes-toggle` present (Switch, state "off")**; `discover-results-count` = **"20 results · near CT"** (initial page fallback — see note below).
3. Tapped toggle **On** → count = **"1207 results · all nodes"**; cross-node items gained **`…-other-node-badge` ("Other Node")** badges (`search-result-17e16c95…`, `search-result-374c61ce…`, `search-result-8c693d06…`).
4. Tapped toggle **Off** → count = **"66 results · near CT"** — matches the DB-verified Norwalk available count (66) exactly.

### Assert result — **PASS**

- Default (Off) = node-scoped (`p_node_ids = [test-buyer's node]`): 66 available ✓ (matches DB).
- Toggle On = all nodes (no `p_node_ids`): 1207 ✓; other-node items carry the **Other Node** badge ✓.
- Toggle Off restores node-only ✓.
- Backend now honors `p_node_ids` (live `pg_get_functiondef`): `search_listings` and `count_listings` both apply `AND (p_node_ids IS NULL OR i.node_id = ANY(p_node_ids))` — the Phase 24 "backend ignores p_node_ids / no toggle" finding is **resolved**.
- Waitlisted/inactive-ZIP users not re-tested this run (covered by prior F02–F04 runs); toggle render is gated `!!userNodeId && !waitlisted` (source).

**Note (minor, cosmetic):** on the very first Discover load the count line shows the page-size fallback (**20**) because `resultCount = totalResultCount ?? results.length` renders before the `count_listings` RPC resolves; after any toggle/refresh it settles on the true count (66). Transient, self-correcting — not a defect, worth a tiny polish (e.g., show a shimmer until count resolves).

**H06 note:** the brief said "re-run AUTH-TC-H06/F06 natively as test-buyer". H06 (onboarding carousel) applies to fresh users and was already PASSed in Phase 23 with fresh accounts; it does not apply to the established `test-buyer` persona. Interpreted the operative case as F06 (the node-scoped behavior previously only testable via a substitute fresh active-node account).

### Perceived load times (F06)
- Login → Home: **<2s** (first poll) — GOOD.
- Discover load + toggle transitions: **<2s** each — GOOD. No ≥3s transitions.

---

## Cross-cutting findings (ranked)

1. **CRITICAL — E05 phone-verification gate is dead code** (gate nested in unreachable `!canPublish()` branch; no server enforcement). Unverified users can publish listings with zero phone verification. (Item 1)
2. **HIGH — Tab bar renders on root-stack ItemCreate (deep-link path) and occludes the Publish button.** Also blocked the E05 empirical tap. (Item 1, friction)
3. **MEDIUM — C04 remains fixture-blocked** (collision pair impossible via UI; UI-level confirmation obtained). Needs dev-provisioned fixture. (Item 2)
4. **LOW — Discover count line shows page-size (20) on first load** before `count_listings` resolves. (Item 3, cosmetic)

## Friction vs operating rules
- **AX-tree logical-vs-rendered coords** on ItemCreate below-fold controls (condition rows, publish) — used screenshot/OCR + pixel-scan for truth (per §5.9/§5.2). One wasted tap on the condition row.
- **ItemCreate scroll "0-movement" at max bottom** — confirmed via pixel-diff (735px / 0.0002%); root cause = tab-bar occlusion, not a broken scroll (content scrolls fine when tab bar absent).
- **LogBox console-error overlay** (from the C04 signup error) intercepted a tab tap — Dismiss button not AX-exposed; pixel-located (Dismiss left / Minimize right) per Phase 14 technique.
- **Vision-OCR** used for most screens (view_image non-delivering this session) — worked reliably.

## App State Left Behind
- Throwaway account `qa.alice.17870920728053931@kidsmarketplace.test` created (unverified, `TestPass123` dev-autofill password) — do not reuse; no cleanup action needed (normal signup, no listings created).
- No listings, trades, or listings-state changes created (E05 never reached a publish; the C04 signup was rejected server-side).
- `test-buyer` left logged-out (cleared via `qa-logout`). App terminated. Simulator on Landing.

---

## 📋 QA Session Handoff

**Test Scope:** AUTH-TC-E05 (phone gate), AUTH Group C04 (account-linking collision), AUTH-TC-F06 (Show All Nodes toggle) — one combined QA verification run (2026-08-18).

**Design-System Compliance:** PASS — no deviations found on screens/dialogs reviewed this run (Signup screen, Login screen, ItemCreate sections visited, Discover screen, Signup Failed dialog). One minor note: ItemCreate price area shows two green CTAs ("Upgrade Now" banner + `upgrade-cta`) in the same region (banner semantics, not a blocking violation).

**Perceived Load-Time Verdict:** GOOD — all observed transitions (deep-link → New Item, login → Home, Discover load, toggle flips) rendered <2s with no ≥3s flags. Label: perceived load time (simulator, wall-clock, ±polling-interval precision) — not a formal performance profile.

**Design & Copy Compliance Confirmation:**
- CONFIRMED — Signup screen: wording/layout match design-system requirements (labels, helper text, spacing).
- CONFIRMED — Login screen: wording/layout match.
- CONFIRMED — "Signup Failed" dialog: copy ("This email is already registered. Please log in instead.") is clear and parent-appropriate; single OK CTA.
- CONFIRMED — ItemCreate (New Item) sections visited: labels, SP estimate copy, condition selector, dev fixtures on-brand.
- CONFIRMED — Discover screen: node-scoped count line + toggle copy ("Show All Nodes On/Off", "near CT"/"all nodes" suffix) clear.

**Verdict Summary:** 1 PASS / 1 FAIL / 1 BLOCKED / 0 SKIPPED.

**Critical Findings:**
1. **CRITICAL — E05 phone-verification gate is dead code.** `isPhoneRequired` check is nested inside `if (!canPublish())` while the Publish button is `disabled={!canPublish()}`; no server-side trigger/RLS enforces phone verification on `items` INSERT. An unverified user can fill a listing form and publish without ever seeing the phone-verification modal. (Source + live-DB + empirical form-fill corroborated.)
2. **HIGH — persistent tab bar renders on the root-stack ItemCreate screen (deep-link path) and occludes the Publish button**, making Publish unreachable on-device in this path.
3. **MEDIUM — C04 account-linking prompt cannot be exercised:** no collision fixture exists, and the only social email (`kidsp2p@gmail.com`) rejects a password signup ("This email is already registered" — UI-confirmed), so the prompt's precondition is impossible to construct via UI.

**App State Left Behind:** throwaway unverified account `qa.alice.17870920728053931@kidsmarketplace.test` (normal signup; no listings created); `test-buyer` logged out; app terminated; simulator on Landing.

**Why It Matters:** Item 1 proves a real, shipping P0-class gap — the phone-verification gate that should protect first listings does not fire at all (unverified sellers can publish). Item 3 closes out a long-standing F06 blocker (seed node-assignment + node-scoped backend now verified working end-to-end as `test-buyer`). Item 2 gives the dev team a precise, UI-confirmed reason C04 needs a non-UI fixture.

**How to Verify/Reproduce:**
- Evidence: `e2e-test-results/qa-combined-verify-e05-c04-f06-2026-08-18/` — 00 landing; 01–04 signup+OTP; 05–10 ItemCreate (dev photo, category Books, title, condition Good, price 12.50); 11–14 publish occlusion (max-bottom, tab bar); 16–17 C04 collision (email + "Signup Failed"); 20–22 F06 (toggle Off 20→On 1207+badges→Off 66).
- E05 gate defect: read `ItemCreateScreen.tsx` L806-818 + L1198 + `PublishButton.tsx`; `pg_policies`/`information_schema.triggers` for `items`.
- C04: `auth.identities` for `kidsp2p@gmail.com`; UI signup with that email → "This email is already registered".
- F06: login `test-buyer@kidsmarketplace.test` → Discover → toggle; `pg_get_functiondef('search_listings'/'count_listings')`; `SELECT count(*) FROM items WHERE node_id='550e8400-…0001' AND status='available'` = 66.

**Known Gaps / Not Tested:**
- E05 Publish *tap* could not be executed on-device (tab-bar occlusion in the deep-link path); outcome instead determined from source + DB + empirical canPublish-true state (conclusive). The listing-creation outcome (item actually inserted) was not observed — recommend re-verifying via the Sell-tab path after the tab-bar bug is fixed.
- E05 phone-verification completion/resume (post-verification publish) — not testable until the gate fires; noted as follow-up per brief.
- C04 `AccountLinkingPrompt` UI — not executable (fixture impossible); returning-user social login path not re-run (C01's domain, OAuth sparing).
- F06 waitlisted-user toggle absence — covered by prior F02–F04 runs, not re-run here.

**What Needs To Be Fixed Next:**
1. Fix: move the `isPhoneRequired` gate OUT of `!canPublish()` to the top of `handlePublish` (before the canPublish check) so the phone-verification modal fires for unverified sellers regardless of form completeness. (E05 — P0)
2. Fix: add a server-side enforcement on `items` INSERT (trigger or RLS `with check`) requiring `phone_verified_at` for non-admin sellers — belt-and-suspenders. (E05 — P1)
3. Fix: prevent the persistent tab bar from rendering over root-stack screens (ItemCreate via deep link) so Publish is reachable; this also unblocks on-device E05 verification. (Item 1 — P1)
4. Fix (dev-team): provision a C04 collision fixture via a NON-UI mechanism (password account + separate OAuth identity sharing an email, or attach an `email` identity to `kidsp2p@gmail.com`'s user with a known password). (Item 2 — P1)
5. Fix (polish): show a loading state for the Discover results-count until `count_listings` resolves, instead of briefly showing the page size (20). (Item 3 — P2)

**UX Enhancement Ideas (optional, not defects):**
- On ItemCreate, the tab bar's presence over the form bottom confused where the final CTA was — once the tab-bar bug is fixed, consider giving the Publish button a sticky/fixed position above the bottom inset so sellers always see it without scrolling to the absolute bottom. (Observed while the Publish button was unreachable at max scroll.)
- On Discover, the "20 results" first-frame fallback could be a subtle skeleton placeholder for the count line — reduces perceived jumpiness. (Observed on first load.)

**Suggested Next Session:** Re-run AUTH-TC-E05 end-to-end (incl. tapping Publish and observing the listing-creation outcome) after the dev team fixes the gate placement + tab-bar occlusion; then close AUTH-TC-C04 once the collision fixture is provisioned.

**Suggested to Improve Agent Rules:** none — the playbook's §5.2/§5.9 (logical-vs-rendered coords, screenshot-as-truth) and §5.9 scroll-blocker pixel-diff, plus the Vision-OCR fallback, handled all friction cleanly this run.
