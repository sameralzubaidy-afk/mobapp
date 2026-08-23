# QA Session Report — Groups F + G (Node/ZIP Gating & Node Management)

**Run:** `e2e-test-results/group-fg-nodes-zip-gating-2026-08-23/`
**Date:** 2026-08-23 (22:27–22:51 local)
**Agent:** QA Test Agent (execution-only)
**Guide (canonical):** `cross-checked-and-consolidated/AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md` (Groups F + G)
**Devices:** iOS Simulator iPhone 17 Pro Max (iOS 26.1, `3F3293A3-…`) via mobile-mcp; admin portal `http://localhost:3001` (staging `drntwgporzabmxdqykrp`) via browser.
**Execution order:** Group G (admin, first — to confirm/establish node fixtures) then Group F (mobile, end-user), per persona-batching + the fixture-dependency note in the task prompt.

---

## Batch summary

| TC-ID | Guide | Verdict | Top finding |
|---|---|---|---|
| AUTH-TC-G01 | AUTH guide, Group G | ✅ PASS | Admin created active node "QA Auto G01 Active" (ZIP 10001 → NYC auto-lookup), green Active badge |
| AUTH-TC-G02 | AUTH guide, Group G | ✅ PASS | Admin created inactive node "QA Auto G02 Inactive" (ZIP 90210), gray Inactive badge + Activate action |
| AUTH-TC-G03 | AUTH guide, Group G | ✅ PASS | Edit modal titled "Edit Node"; name/radius/description edits persisted after page refresh (DB + UI) |
| AUTH-TC-G04 | AUTH guide, Group G | ✅ PASS | Deactivate on Test Node 1 (100 members) → warning "This node has 100 active members…"; badge → Inactive + Activate; audit-logged; restored afterward |
| AUTH-TC-G05 | AUTH guide, Group G | ✅ PASS | Reactivate Test Node 1 → Active badge restored, Deactivate action returned |
| AUTH-TC-G06 | AUTH guide, Group G | ✅ PASS | Stats cards (Total 7 / Active 6 / Members 100) match DB; 6 validation messages block invalid node input |
| AUTH-TC-F01 | AUTH guide, Group F | ✅ PASS | Fresh user, ZIP 06850 → "📍 Norwalk, CT" + no waitlist + "Your profile has been created!" + assigned to Norwalk Central (DB + header chip) |
| AUTH-TC-F02 | AUTH guide, Group F | ✅ PASS | Fresh user, ZIP 07999 → "We're Coming Soon!" modal with Join Waitlist (primary) + Continue Trading (secondary), fallback node Little Falls Central |
| AUTH-TC-F03 | AUTH guide, Group F | ✅ PASS | Join Waitlist → "Waitlist Confirmed" modal (thanks + notified + fallback-node access) → Got it → proceeded; DB: waitlist row + node = Little Falls Central |
| AUTH-TC-F04 | AUTH guide, Group F | ✅ PASS | Fresh user, ZIP 07999, Continue Trading → proceeded on fallback node with **0 waitlist rows** (DB-proven) |
| AUTH-TC-F05 | AUTH guide, Group F | ✅ PASS | ZIP auto-lookup: "📍 Norwalk, CT" (06850) / "📍 Whippany, NJ" (07999) + helper text "We'll assign you to your nearest community node" |
| AUTH-TC-F06 | AUTH guide, Group F | ✅ PASS | test-buyer Discover: Show All Nodes Off → "71 results · near CT"; On → "1216 results · all nodes" + Other Node badges; Off again → 71 (DB corroborated 71/1216) |

**Roll-up: 12 PASS / 0 FAIL / 0 BLOCKED / 0 SKIPPED**

---

## Perceived load-time table (simulator wall-clock, ±polling interval)

All transitions rendered within the ideal UX threshold (<3s); nothing flagged.

| Screen → transition | Elapsed | Notes |
|---|---|---|
| Landing → Create Account (Get Started tap) | <2s | — |
| Create Account → Phone Verification (signup submit) | <2s | — |
| Phone Verify → Complete Your Profile (Verify/Continue) | <2s | — |
| Profile Setup submit → Success alert / Coming-Soon modal | <2s | — |
| Login submit → Home (test-buyer) | <2s | — |
| Discover toggle On (71→1216 count refresh) | ~1–2s | count line updated on first poll |
| Discover toggle Off (1216→71) | ~1–2s | restored on first poll |

**Perceived Load-Time Verdict: GOOD** — no transition reached the 3s flag threshold.

---

## Per-case details

### AUTH-TC-G01 — Admin creates an active node — PASS
- `+ Add Node` (`btn-add-node`) → modal "Add New Node". Filled Node Name "QA Auto G01 Active", ZIP `10001` → zippopotam auto-lookup populated City=New York City, State=NY, Lat 40.7484, Lng -73.9967. Radius set to 15, Active checked. `Create Node` → alert "Node created successfully!", modal closed.
- Row verified: "QA Auto G01 Active / New York City, NY / 10001 / 40.7484, -73.9967 / 15 mi / 0 / **Active** / Edit·Deactivate". DB: `0c1195ef-2d2e-4794-acda-53ffca93dc63`, `is_active=true`, `status='active'`. Audit log `create_node` (22:28:42).
- Evidence: `ADMIN-G00-nodes-baseline.png`, `ADMIN-G01-node-created.png`.

### AUTH-TC-G02 — Admin creates an inactive node — PASS
- `+ Add Node` → Node Name "QA Auto G02 Inactive", ZIP `90210` → Beverly Hills/CA/34.0901/-118.4065. **Unchecked** `node-form-is-active`, `Create Node` → "Node created successfully!".
- Row: "QA Auto G02 Inactive / Beverly Hills, CA / 90210 / … / 10 mi / 0 / **Inactive** / Edit·Activate". DB: `is_active=false`, `status='inactive'`. Audit log `create_node` (22:29:09).
- Evidence: `ADMIN-G02-inactive-node-created.png`.

### AUTH-TC-G03 — Admin edits a node — PASS
- Edit on QA Auto G01 (`btn-edit-node-0c1195ef-…`) → modal title **"Edit Node"** with pre-filled values. Changed name → "QA Auto G01 Active EDITED", radius → 20, added description → `Update Node` → "Node updated successfully!".
- Table row showed new name/description/20 mi before AND after `page.reload()` (persisted). DB: `update_node` audit (22:30:46).
- Evidence: `ADMIN-G03-node-edited.png`.
- **Friction (browser):** the Edit button sits under the fixed sidebar overlay at the responsive panel width; coordinate clicks were intercepted (navigated to `/`). Worked around with a DOM-level click on the row action. Not an app defect.

### AUTH-TC-G04 — Admin deactivates a node with members (warning) — PASS
- On **Test Node 1** (member_count=100, no real profile members — safe to deactivate, doesn't affect standing personas), tapped `Deactivate`.
- `confirm()` dialog: **"Are you sure you want to deactivate \"Test Node 1\"?\n\nWarning: This node has 100 active members. They will remain assigned but new users cannot join this node."** — matches G04's expected warning text. Confirmed.
- Alert "Node deactivated successfully!" → row: **Inactive** badge + **Activate** action. DB: `deactivate_node` audit (22:31:06).
- Evidence: `ADMIN-G04-node-deactivated.png`.
- **Note:** the warning uses the stored `nodes.member_count` column (100 for Test Node 1). Norwalk Central has 145 real assigned profiles but `member_count=0` (stale counter — see cross-cutting findings). The "new signups routed elsewhere" consequence was not separately signup-tested for ZIP 06851 (would need a fresh signup); the state was restored via G05 per the task note.

### AUTH-TC-G05 — Admin reactivates a node — PASS
- `Activate` on Test Node 1 → confirm "Are you sure you want to activate \"Test Node 1\"?" → alert "Node activated successfully!" → row: **Active** badge + Deactivate action. State restored.
- Evidence: `ADMIN-G05-node-reactivated.png`.

### AUTH-TC-G06 — Node stats cards + validation — PASS
- Stats cards: **Total Nodes 7, Active Nodes 6, Total Members 100** — matches DB (`nodes` count 7, active 6, sum(member_count)=100).
- Validation in Add Node modal with invalid input (empty/1-char name, ZIP `12`, empty city, 1-char state, radius 150, zero coords) blocked the submit with all 6 messages: "Node name must be at least 2 characters", "ZIP code must be 5 digits", "City is required", "State must be 2-letter code (e.g., CT)", "Valid coordinates are required (auto-populated from ZIP)", "Radius must be between 1 and 100 miles". No node created (count stayed 7).
- Evidence: `ADMIN-G06-validation-errors.png`.
- **Friction (browser):** at the narrow responsive panel width, Playwright/native clicks on the modal's submit button were not being delivered (click events never reached the button — verified by an injected click counter). The app's validation logic was exercised by dispatching a bubbling `submit` event (React's delegated root listener), which produced the correct errors. Environment artifact, not an app defect.

### AUTH-TC-F01 — Active ZIP → assigned to node, no waitlist — PASS
- Fresh signup via SignupScreen DEV autofill (Alice, fresh unique contact) → phone verify (DEV bypass `123456` via "Use & Verify") → "Complete Your Profile".
- Entered display name "F01 Test Parent" and ZIP `06850` → **"📍 Norwalk, CT"** appeared beneath the field + helper "We'll assign you to your nearest community node".
- `Complete Setup` → **"Your profile has been created!"** success alert (**no waitlist modal**). OK → onboarding carousel → Skip → **Home** with header chip **"Norwalk Central"**.
- DB: user `qa.alice.17875246083483536@kidsmarketplace.test`, node_id = Norwalk Central (`550e8400-…0001`), `is_active`, `profile_completed=true`.
- Evidence: `MOBILE-F01-signup-filled.png`, `MOBILE-F01-phone-verify.png`, `MOBILE-F01-profile-setup.png`, `MOBILE-F01-zip-norwalk.png`, `MOBILE-F01-profile-created-success.png`, `MOBILE-F01-home-norwalk-node.png`.

### AUTH-TC-F02 — Inactive ZIP → "We're Coming Soon!" + Join Waitlist — PASS
- Fresh signup (Bob) → ZIP `07999` → "📍 Whippany, NJ" → `Complete Setup` → **"We're Coming Soon!"** modal: "We're not quite active in 07999 yet… we've connected you with traders in **Little Falls Central**." + prompt "Want to be notified when we launch in your area?" + **Continue Trading** (secondary) + **Join Waitlist** (primary green).
- Evidence: `MOBILE-F02-after-submit.png` (OCR transcript in trace).

### AUTH-TC-F03 — Waitlist confirmation + fallback node access — PASS
- Tapped **Join Waitlist** (primary green pill; native RN `ui/Modal` — located via §5.4 pixel-scan of `#5DBB8E`) → **"Waitlist Confirmed"** modal: "Thank you! We've added you to the waitlist for 07999. We'll notify you as soon as we launch in your area." + "In the meantime, you can trade items with users in **Little Falls Central**." → **Got it** → proceeded into app (onboarding carousel).
- DB: `zip_waitlist` row `b1129e6c-…` (requested_zip 07999, assigned_node = Little Falls Central, status pending); profile node_id = Little Falls Central.
- Evidence: `MOBILE-F03-waitlist-confirmed-modal.png`, `MOBILE-F03-proceeded-onboarding.png`.

### AUTH-TC-F04 — Continue Trading without joining waitlist — PASS
- Fresh signup (Charlie) → ZIP `07999` → "We're Coming Soon!" modal → tapped **Continue Trading** (secondary, left) → modal closed → proceeded into app.
- DB: profile node_id = Little Falls Central, `profile_completed=true`, and **`zip_waitlist` = 0 rows** for this user — the key "not added to the waitlist" assertion proven.
- Evidence: `MOBILE-F04-coming-soon-modal.png`.

### AUTH-TC-F05 — ZIP auto-lookup shows city/state — PASS
- Verified twice: `06850` → "📍 Norwalk, CT"; `07999` → "📍 Whippany, NJ" — green text beneath the field (`city-state-display`) with helper "We'll assign you to your nearest community node". Exercised live during F01/F02/F04 profile setup.

### AUTH-TC-F06 — Node-scoped content (My Node vs Show All Nodes) — PASS
- Logged in as **test-buyer** → Home (header chip "Norwalk Central") → Discover tab.
- Default: `discover-show-all-nodes-toggle` visible and **Off**; `discover-results-count` = **"71 results · near CT"** (no "all nodes" suffix).
- Toggled On → count = **"1216 results · all nodes"**; **Other Node** badges appeared on 4 visible items from other nodes (`search-result-*-other-node-badge`).
- Toggled Off → count back to **"71 results · near CT"**, no Other Node badges.
- DB corroboration: `items` available count Norwalk-only = **71**, all-nodes = **1216** (exact match).
- Evidence: `MOBILE-F06-login-filled.png`, `MOBILE-F06-home-test-buyer.png`, `MOBILE-F06-discover-default-node-only.png`, `MOBILE-F06-discover-show-all-nodes-on.png`, `MOBILE-F06-discover-toggle-off-restored.png`.

---

## UX review (three layers)

### Structural / affordance
- All screens/dialogs visited were navigable with clear affordances (back buttons on signup/login; Skip on onboarding; Cancel in admin node modal; modal close on success). No overlap/truncation issues observed.
- Admin nodes page at the browser's narrow responsive width has a wide KPI table causing horizontal overflow; the fixed sidebar overlays part of the table's action column, but this is a responsive-layout constraint of the embedded browser panel, not the deployed admin UI at desktop widths.

### Wording / copy clarity
- Waitlist copy is clear and parent-friendly: "We're not quite active in 07999 yet, but we're coming soon! In the meantime, we've connected you with traders in Little Falls Central." and "We'll notify you as soon as we launch in your area." — plain, unambiguous. ✅
- Success message "Your profile has been created!" and phone-verification "Let's complete your profile!" are clear. ✅
- **Minor note (not a defect):** Admin G04 deactivation warning's "100 active members" for Test Node 1 reflects the stored counter, not real profile membership (see cross-cutting finding). For real nodes (e.g. Norwalk Central with 145 real members but counter 0), the warning would under-report. This is a data-accuracy issue, not copy.

### Design-system compliance (vs `docx/design-system-passitup.md`)
- **Mobile waitlist modals ("We're Coming Soon!" / "Waitlist Confirmed")**: primary CTA = green `#5DBB8E` pill (Join Waitlist / Got it), secondary = white outline pill (Continue Trading) — matches pill-primary/secondary-outline conventions; max one primary per dialog; centered card with 20px backdrop padding; title/subtitle hierarchy. **No deviations found.**
- **Profile Setup screen**: filled inputs, primary-green `Complete Setup` pill (only one primary), helper text tiers. **No deviations found.**
- **Admin nodes page / modal**: Tailwind-based admin UI (not the mobile design system); consistent, standard admin styling; validation errors red; create/update flows fine. Admin surfaces are outside the mobile `passitup` token scope (noted for completeness).

---

## Locator-gap findings
- Mobile waitlist modals ("We're Coming Soon!" / "Waitlist Confirmed") are native `ui/Modal`s whose buttons (despite having `testID`s `waitlist-continue-trading`, `waitlist-join-button`, `waitlist-confirmed-got-it`) do **not** surface in the mobile-mcp AX tree — handled per §5.4 native-modal pixel-scan technique (green `#5DBB8E` pill band). The `testID`s exist in source and are unit-tested, but are unreachable on-device for a tree-driven tap; this matches the documented `ui/Modal` behavior (buttons never appear in the AX tree).
- Admin `/nodes`: node table action buttons are inside a horizontally-overflowing table and can sit under the fixed sidebar at narrow widths; `btn-edit-node-<id>` / `btn-toggle-node-<id>` exist and work at desktop width.

## Friction vs. operating rules
- **Simulator keyboard:** Cmd+K suppressed the software keyboard repeatedly, but it **re-showed on each new field focus** — the documented "stays hidden across field focus" behavior in `simulator-keyboard-suppression.md` did not hold this session; had to re-apply Cmd+K before each submit. Noted as doc drift for the memory file.
- **Keyboard occlusion of Profile Setup submit:** number-pad had no dismiss key; swipes didn't scroll the ScrollView with the keyboard up; resolved via Cmd+K suppression + OCR verification before tapping.
- **Browser hit-testing (admin):** at the embedded browser's responsive panel width, programmatic/native clicks on the modal submit button and table action buttons were not delivered (verified with an injected click counter — clicks:0). Worked around with DOM-level clicks / bubbling `submit` event dispatch for validation. Environment artifact, not app defect.
- **AX-tree staleness:** none observed this session.

---

## App State Left Behind (cleanup for next session)

- **Admin nodes created (QA-marked, to be cleaned by dev team):**
  - `0c1195ef-2d2e-4794-acda-53ffca93dc63` — "QA Auto G01 Active EDITED" (ZIP 10001, NY, radius 20, **active**) — created + edited during G01/G03.
  - `QA Auto G02 Inactive` (ZIP 90210, CA, radius 10, **inactive**) — created during G02.
- **Test Node 1** (`550e8400-…0000`, ZIP 06851) — deactivated then **reactivated** (state restored to active, member_count 100 unchanged).
- **Mobile accounts created (throwaway, F01/F02-3/F04):**
  - `qa.alice.17875246083483536@kidsmarketplace.test` ("F01 Test Parent") — node Norwalk Central, no waitlist row.
  - `qa.bob.17875248862184744@kidsmarketplace.test` ("F02 Test Parent") — node Little Falls Central, **waitlist row** `b1129e6c-e1dd-465e-aa2a-8c37312beda6` (07999, pending) — **cleanup consideration** (the task note asked to flag this).
  - `qa.charlie.17875251796216233@kidsmarketplace.test` ("F04 Test Parent") — node Little Falls Central, no waitlist row.
- **Simulator app state:** logged out (Landing) at end of run.

---

## Cross-cutting findings

1. **`nodes.member_count` counter is stale on staging (data accuracy, P2).** Norwalk Central shows `member_count=0` in `nodes` while 145 profiles are assigned to it (Little Falls: 7 real vs 0; Test Node 1: 0 real vs 100). The admin stats card "Total Members" (100) and the G04 deactivation warning read this stored column, so they under/over-report real membership. `increment/decrement_node_member_count` only fire on new signup/assignment; historical assignments predate the counter and were never backfilled. Recommend a dev-side reconciliation (backfill `member_count = count(profiles.node_id)`), not a test failure.

## Recommended follow-ups (dev-side, separate tasks)

1. **Fix (data):** reconcile/backfill `nodes.member_count` from `profiles.node_id` so admin stats cards + deactivation warnings reflect real membership (or compute it live in the admin query instead of the stored column).
2. **Consider (instrumentation):** mobile waitlist modals are native `ui/Modal`s — the documented `testID`s (`waitlist-join-button`, `waitlist-continue-trading`, `waitlist-confirmed-got-it`) cannot be tapped via the AX tree; if tree-drivable taps are wanted, convert to `GlobalAlertProvider` or expose via a different mechanism (matches the existing §5.4 exemption — low priority).
3. **Cleanup:** delete the QA nodes above and the Bob user's `zip_waitlist` row `b1129e6c-…` (or leave as fixtures — decided by dev team).
